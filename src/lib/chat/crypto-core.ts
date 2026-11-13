import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const AES_ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const NONCE_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const HKDF_SALT = Buffer.from("ihyaa-chat-hkdf-salt-v1", "utf8");

export class ChatEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatEncryptionError";
  }
}

export interface ChatKeyring {
  activeVersion: number;
  keys: Map<number, Buffer>;
}

export interface EncryptMessageInput {
  plaintext: string;
  conversationId: string;
  messageId: string;
  senderId: string;
}

export interface EncryptedMessagePayload {
  ciphertext: string;
  nonce: string;
  keyVersion: number;
}

export interface DecryptMessageInput {
  ciphertext: string;
  nonce: string;
  keyVersion: number;
  conversationId: string;
  messageId: string;
  senderId: string;
}

function decodeBase64Key(raw: string): Buffer {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ChatEncryptionError("Chat encryption key is missing");
  }
  const key = Buffer.from(trimmed, "base64");
  if (key.byteLength !== KEY_BYTES) {
    throw new ChatEncryptionError("Chat encryption key must decode to exactly 32 bytes");
  }
  return key;
}

function parseVersion(raw: string | undefined, fallback = 1): number {
  if (!raw || !raw.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ChatEncryptionError("Chat encryption key version must be a positive integer");
  }
  return parsed;
}

export function loadKeyringFromEnv(env: NodeJS.ProcessEnv = process.env): ChatKeyring {
  const primaryRaw = env.CHAT_ENCRYPTION_KEY;
  if (!primaryRaw || !primaryRaw.trim()) {
    throw new ChatEncryptionError("CHAT_ENCRYPTION_KEY is not configured");
  }
  const activeVersion = parseVersion(env.CHAT_ENCRYPTION_KEY_VERSION, 1);
  const keys = new Map<number, Buffer>();
  keys.set(activeVersion, decodeBase64Key(primaryRaw));

  const prevRaw = env.CHAT_ENCRYPTION_KEYS_PREVIOUS;
  if (prevRaw && prevRaw.trim()) {
    for (const entry of prevRaw.split(",")) {
      const part = entry.trim();
      if (!part) continue;
      const colonIdx = part.indexOf(":");
      if (colonIdx <= 0) {
        throw new ChatEncryptionError("CHAT_ENCRYPTION_KEYS_PREVIOUS entries must use version:base64 format");
      }
      const ver = parseVersion(part.slice(0, colonIdx), 0);
      const key = decodeBase64Key(part.slice(colonIdx + 1));
      if (!keys.has(ver)) {
        keys.set(ver, key);
      }
    }
  }

  return { activeVersion, keys };
}

function deriveConversationKey(masterKey: Buffer, conversationId: string, keyVersion: number): Buffer {
  const info = Buffer.from(`ihyaa:chat:conv:${conversationId}:v${keyVersion}`, "utf8");
  return Buffer.from(hkdfSync("sha256", masterKey, HKDF_SALT, info, KEY_BYTES));
}

function buildMessageAad(conversationId: string, messageId: string, senderId: string): Buffer {
  if (!conversationId || !messageId || !senderId) {
    throw new ChatEncryptionError("Encryption AAD requires conversationId, messageId, and senderId");
  }
  return Buffer.from(JSON.stringify([conversationId, messageId, senderId]), "utf8");
}

export function encryptMessage(
  input: EncryptMessageInput,
  keyring: ChatKeyring = loadKeyringFromEnv(),
): EncryptedMessagePayload {
  const { plaintext, conversationId, messageId, senderId } = input;
  if (typeof plaintext !== "string") {
    throw new ChatEncryptionError("Message plaintext must be a string");
  }
  const masterKey = keyring.keys.get(keyring.activeVersion);
  if (!masterKey || masterKey.byteLength !== KEY_BYTES) {
    throw new ChatEncryptionError("Active chat encryption key is missing or invalid");
  }

  const nonce = randomBytes(NONCE_BYTES);
  const aad = buildMessageAad(conversationId, messageId, senderId);
  const subkey = deriveConversationKey(masterKey, conversationId, keyring.activeVersion);

  try {
    const cipher = createCipheriv(AES_ALGORITHM, subkey, nonce, { authTagLength: AUTH_TAG_BYTES });
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      ciphertext: `${encrypted.toString("base64")}.${tag.toString("base64")}`,
      nonce: nonce.toString("base64"),
      keyVersion: keyring.activeVersion,
    };
  } finally {
    subkey.fill(0);
  }
}

export function decryptMessage(
  input: DecryptMessageInput,
  keyring: ChatKeyring = loadKeyringFromEnv(),
): string {
  const { ciphertext, nonce, keyVersion, conversationId, messageId, senderId } = input;
  const masterKey = keyring.keys.get(keyVersion);
  if (!masterKey || masterKey.byteLength !== KEY_BYTES) {
    throw new ChatEncryptionError(`No chat decryption key available for version ${keyVersion}`);
  }

  const parts = ciphertext.split(".");
  if (parts.length !== 2 || !parts[1]) {
    throw new ChatEncryptionError("Malformed encrypted message payload");
  }
  const encryptedBuf = Buffer.from(parts[0], "base64");
  const tagBuf = Buffer.from(parts[1], "base64");
  const nonceBuf = Buffer.from(nonce, "base64");

  if (nonceBuf.byteLength !== NONCE_BYTES || tagBuf.byteLength !== AUTH_TAG_BYTES) {
    throw new ChatEncryptionError("Invalid encrypted message nonce or authentication tag");
  }

  const aad = buildMessageAad(conversationId, messageId, senderId);
  const subkey = deriveConversationKey(masterKey, conversationId, keyVersion);

  try {
    const decipher = createDecipheriv(AES_ALGORITHM, subkey, nonceBuf, { authTagLength: AUTH_TAG_BYTES });
    decipher.setAAD(aad);
    decipher.setAuthTag(tagBuf);
    const decrypted = Buffer.concat([decipher.update(encryptedBuf), decipher.final()]);
    return decrypted.toString("utf8");
  } catch (err) {
    if (err instanceof ChatEncryptionError) throw err;
    throw new ChatEncryptionError("Message authentication failed");
  } finally {
    subkey.fill(0);
  }
}

export function rotateMessageEncryption(
  input: DecryptMessageInput,
  targetKeyring: ChatKeyring = loadKeyringFromEnv(),
): EncryptedMessagePayload {
  const plaintext = decryptMessage(input, targetKeyring);
  return encryptMessage(
    {
      plaintext,
      conversationId: input.conversationId,
      messageId: input.messageId,
      senderId: input.senderId,
    },
    targetKeyring,
  );
}
