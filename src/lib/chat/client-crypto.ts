"use client";

import type { ChatMessageItem } from "@/components/chat/chat-types";
import type { WireEncryptedMessagePayload } from "@/lib/chat/realtime/types";

export interface ConversationKeyEntry {
  keyVersion: number;
  keyEpoch: number;
  keyBase64: string;
}

export interface ConversationKeyBundle {
  conversationId: string;
  keyVersion: number;
  keyEpoch: number;
  keys: ConversationKeyEntry[];
  expiresAt: number;
}

interface CachedCryptoKey {
  key: CryptoKey;
  expiresAt: number;
}

const KEY_CACHE_TTL_MS = 15 * 60 * 1000;
const keyCache = new Map<string, CachedCryptoKey>();
const inflightKeyFetches = new Map<string, Promise<boolean>>();

function cacheSlot(
  conversationId: string,
  keyVersion: number,
  keyEpoch: number,
): string {
  return `${conversationId}:v${keyVersion}:e${keyEpoch > 1 ? keyEpoch : 1}`;
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export function clearClientConversationKeys(conversationId?: string): void {
  if (!conversationId) {
    keyCache.clear();
    return;
  }
  const prefix = `${conversationId}:`;
  for (const key of keyCache.keys()) {
    if (key.startsWith(prefix)) {
      keyCache.delete(key);
    }
  }
}

export async function storeConversationKeyBundle(
  bundle: ConversationKeyBundle,
): Promise<void> {
  if (typeof crypto === "undefined" || !crypto.subtle) return;
  const expiresAt = bundle.expiresAt || Date.now() + KEY_CACHE_TTL_MS;
  await Promise.all(
    bundle.keys.map(async (entry) => {
      const slot = cacheSlot(
        bundle.conversationId,
        entry.keyVersion,
        entry.keyEpoch,
      );
      const raw = base64ToBytes(entry.keyBase64);
      const imported = await crypto.subtle.importKey(
        "raw",
        raw,
        { name: "AES-GCM" },
        false,
        ["decrypt"],
      );
      keyCache.set(slot, { key: imported, expiresAt });
    }),
  );
}

export async function ensureConversationKey(
  conversationId: string,
  keyVersion: number,
  keyEpoch = 1,
): Promise<CryptoKey | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  const epoch = keyEpoch > 1 ? keyEpoch : 1;
  const slot = cacheSlot(conversationId, keyVersion, epoch);
  const existing = keyCache.get(slot);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.key;
  }

  let pending = inflightKeyFetches.get(slot);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetch(
          `/api/chat/conversations/${encodeURIComponent(conversationId)}/key`,
          { cache: "no-store" },
        );
        if (!res.ok) return false;
        const bundle = (await res.json()) as ConversationKeyBundle;
        await storeConversationKeyBundle(bundle);
        return true;
      } catch {
        return false;
      } finally {
        inflightKeyFetches.delete(slot);
      }
    })();
    inflightKeyFetches.set(slot, pending);
  }

  const ok = await pending;
  if (!ok) return null;
  return keyCache.get(slot)?.key ?? null;
}

export async function decryptWireCiphertext(params: {
  conversationId: string;
  messageId: string;
  senderId: string;
  ciphertext: string;
  nonce: string;
  keyVersion: number;
  keyEpoch?: number;
}): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  if (!params.ciphertext || !params.nonce) return "";

  const dotIdx = params.ciphertext.indexOf(".");
  if (dotIdx <= 0) return null;
  const cipherB64 = params.ciphertext.slice(0, dotIdx);
  const tagB64 = params.ciphertext.slice(dotIdx + 1);
  if (!cipherB64 || !tagB64) return null;

  const cryptoKey = await ensureConversationKey(
    params.conversationId,
    params.keyVersion,
    params.keyEpoch ?? 1,
  );
  if (!cryptoKey) return null;

  try {
    const cipherBytes = base64ToBytes(cipherB64);
    const tagBytes = base64ToBytes(tagB64);
    const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
    combined.set(cipherBytes, 0);
    combined.set(tagBytes, cipherBytes.length);

    const nonceBytes = base64ToBytes(params.nonce);
    const aadStr = JSON.stringify([
      params.conversationId,
      params.messageId,
      params.senderId,
    ]);
    const aadBytes = new TextEncoder().encode(aadStr);

    const plainBuf = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: nonceBytes,
        additionalData: aadBytes,
        tagLength: 128,
      },
      cryptoKey,
      combined,
    );

    return new TextDecoder().decode(plainBuf);
  } catch {
    return null;
  }
}

export async function decryptWireMessageToDto(
  wire: WireEncryptedMessagePayload,
): Promise<ChatMessageItem | null> {
  const aadSender = wire.isAnonymized ? "anonymized" : (wire.senderId ?? "");
  const [bodyResult, replyResult] = await Promise.all([
    wire.deleted || !wire.ciphertext || !wire.nonce
      ? Promise.resolve("")
      : decryptWireCiphertext({
          conversationId: wire.conversationId,
          messageId: wire.id,
          senderId: aadSender,
          ciphertext: wire.ciphertext,
          nonce: wire.nonce,
          keyVersion: wire.keyVersion,
          keyEpoch: wire.keyEpoch,
        }),
    wire.replyTo && !wire.replyTo.deleted && wire.replyTo.ciphertext && wire.replyTo.nonce
      ? decryptWireCiphertext({
          conversationId: wire.conversationId,
          messageId: wire.replyTo.id,
          senderId: wire.replyTo.isAnonymized
            ? "anonymized"
            : (wire.replyTo.senderId ?? ""),
          ciphertext: wire.replyTo.ciphertext,
          nonce: wire.replyTo.nonce,
          keyVersion: wire.replyTo.keyVersion,
          keyEpoch: wire.replyTo.keyEpoch,
        })
      : Promise.resolve(wire.replyTo ? "" : null),
  ]);

  if (!wire.deleted && bodyResult === null) {
    return null;
  }

  return {
    id: wire.id,
    clientId: wire.clientId,
    conversationId: wire.conversationId,
    senderId: wire.isAnonymized ? null : wire.senderId,
    sender: wire.sender,
    isAnonymized: wire.isAnonymized,
    type: wire.type,
    body: bodyResult ?? "",
    ...(bodyResult === null ? { decryptionFailed: true } : {}),
    replyTo: wire.replyTo
      ? {
          id: wire.replyTo.id,
          senderId: wire.replyTo.isAnonymized ? null : wire.replyTo.senderId,
          senderName: wire.replyTo.isAnonymized ? null : wire.replyTo.senderName,
          body: replyResult ?? "",
          ...(replyResult === null ? { decryptionFailed: true } : {}),
          deleted: wire.replyTo.deleted,
        }
      : null,
    invite: wire.invite,
    createdAt: wire.createdAt,
    editedAt: wire.editedAt,
    deleted: wire.deleted,
  };
}
