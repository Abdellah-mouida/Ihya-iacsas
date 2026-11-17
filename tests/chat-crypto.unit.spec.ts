import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

import {
  ChatEncryptionError,
  decryptMessage,
  encryptMessage,
  loadKeyringFromEnv,
  rotateMessageEncryption,
  type ChatKeyring,
} from "@/lib/chat/crypto-core";

function makeKeyring(version = 1, keyBuf = randomBytes(32)): ChatKeyring {
  return {
    activeVersion: version,
    keys: new Map([[version, keyBuf]]),
  };
}

test("server-only guard is present on src/lib/chat/crypto.ts", () => {
  const source = readFileSync(path.join(process.cwd(), "src/lib/chat/crypto.ts"), "utf8");
  expect(source).toContain('import "server-only"');
});

test("AES-256-GCM round trip with Arabic, English, and emoji using random nonces", () => {
  const keyring = makeKeyring(1);
  const plaintext = "السلام عليكم — Welcome to Ihyaa! 🌿";
  const meta = {
    conversationId: "conv_public_1",
    messageId: "msg_abc_123",
    senderId: "user_sender_1",
  };

  const first = encryptMessage({ plaintext, ...meta }, keyring);
  const second = encryptMessage({ plaintext, ...meta }, keyring);

  expect(first.keyVersion).toBe(1);
  expect(first.nonce).not.toBe(second.nonce);
  expect(first.ciphertext).not.toBe(second.ciphertext);
  expect(Buffer.from(first.nonce, "base64").byteLength).toBe(12);

  expect(decryptMessage({ ...first, ...meta }, keyring)).toBe(plaintext);
  expect(decryptMessage({ ...second, ...meta }, keyring)).toBe(plaintext);
});

test("tamper detection fails closed on ciphertext, auth tag, and nonce modification", () => {
  const keyring = makeKeyring(1);
  const meta = {
    conversationId: "conv_dm_1",
    messageId: "msg_1",
    senderId: "user_1",
  };
  const payload = encryptMessage({ plaintext: "Private message", ...meta }, keyring);
  const [encB64, tagB64] = payload.ciphertext.split(".");

  const tamperedEnc = Buffer.from(encB64, "base64");
  tamperedEnc[0] ^= 0xff;
  expect(() =>
    decryptMessage({ ...payload, ciphertext: `${tamperedEnc.toString("base64")}.${tagB64}`, ...meta }, keyring),
  ).toThrow(ChatEncryptionError);

  const tamperedTag = Buffer.from(tagB64, "base64");
  tamperedTag[0] ^= 0x01;
  expect(() =>
    decryptMessage({ ...payload, ciphertext: `${encB64}.${tamperedTag.toString("base64")}`, ...meta }, keyring),
  ).toThrow(ChatEncryptionError);

  const tamperedNonce = Buffer.from(payload.nonce, "base64");
  tamperedNonce[0] ^= 0x80;
  expect(() =>
    decryptMessage({ ...payload, nonce: tamperedNonce.toString("base64"), ...meta }, keyring),
  ).toThrow(ChatEncryptionError);
});

test("wrong AAD (conversationId, messageId, or senderId) fails decryption", () => {
  const keyring = makeKeyring(1);
  const meta = {
    conversationId: "conv_1",
    messageId: "msg_1",
    senderId: "user_1",
  };
  const payload = encryptMessage({ plaintext: "Bound to AAD", ...meta }, keyring);

  expect(() =>
    decryptMessage({ ...payload, ...meta, conversationId: "conv_2" }, keyring),
  ).toThrow(ChatEncryptionError);
  expect(() =>
    decryptMessage({ ...payload, ...meta, messageId: "msg_2" }, keyring),
  ).toThrow(ChatEncryptionError);
  expect(() =>
    decryptMessage({ ...payload, ...meta, senderId: "user_2" }, keyring),
  ).toThrow(ChatEncryptionError);
});

test("wrong key version fails closed and key rotation re-encrypts cleanly", () => {
  const v1Key = randomBytes(32);
  const v2Key = randomBytes(32);
  const keyringV1 = makeKeyring(1, v1Key);

  const meta = {
    conversationId: "conv_room_1",
    messageId: "msg_rotate_1",
    senderId: "user_a",
  };
  const payloadV1 = encryptMessage({ plaintext: "Rotate me", ...meta }, keyringV1);

  const keyringOnlyV2 = makeKeyring(2, v2Key);
  expect(() => decryptMessage({ ...payloadV1, ...meta }, keyringOnlyV2)).toThrow(ChatEncryptionError);

  const rotationKeyring = loadKeyringFromEnv({
    NODE_ENV: "test",
    CHAT_ENCRYPTION_KEY: v2Key.toString("base64"),
    CHAT_ENCRYPTION_KEY_VERSION: "2",
    CHAT_ENCRYPTION_KEYS_PREVIOUS: `1:${v1Key.toString("base64")}`,
  });

  expect(decryptMessage({ ...payloadV1, ...meta }, rotationKeyring)).toBe("Rotate me");

  const rotated = rotateMessageEncryption({ ...payloadV1, ...meta }, rotationKeyring);
  expect(rotated.keyVersion).toBe(2);
  expect(decryptMessage({ ...rotated, ...meta }, keyringOnlyV2)).toBe("Rotate me");
});

test("missing or malformed CHAT_ENCRYPTION_KEY fails closed", () => {
  expect(() => loadKeyringFromEnv({ NODE_ENV: "test" })).toThrow(ChatEncryptionError);
  expect(() => loadKeyringFromEnv({ NODE_ENV: "test", CHAT_ENCRYPTION_KEY: "too-short" })).toThrow(ChatEncryptionError);
});
