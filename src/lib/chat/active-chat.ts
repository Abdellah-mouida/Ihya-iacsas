"use client";

let activeConversationId: string | null = null;
const listeners = new Set<(conversationId: string | null) => void>();

const pendingDeliveryTimers = new Map<string, number>();
const pendingDeliveryAt = new Map<string, string>();
const lastAckedAt = new Map<string, string>();

export function setActiveChatConversation(conversationId: string | null): void {
  activeConversationId = conversationId;
  for (const listener of listeners) {
    try {
      listener(conversationId);
    } catch {}
  }
}

export function getActiveChatConversation(): string | null {
  return activeConversationId;
}

export function onActiveChatConversationChange(
  listener: (conversationId: string | null) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function scheduleDeliveryAck(conversationId: string, atIso: string): void {
  if (typeof window === "undefined" || !conversationId) return;
  const normalizedAt = atIso || new Date().toISOString();
  const prevAcked = lastAckedAt.get(conversationId);
  if (prevAcked && new Date(prevAcked).getTime() >= new Date(normalizedAt).getTime()) {
    return;
  }

  const prevQueued = pendingDeliveryAt.get(conversationId);
  if (
    !prevQueued ||
    new Date(normalizedAt).getTime() > new Date(prevQueued).getTime()
  ) {
    pendingDeliveryAt.set(conversationId, normalizedAt);
  }

  if (pendingDeliveryTimers.has(conversationId)) return;

  const timer = window.setTimeout(() => {
    pendingDeliveryTimers.delete(conversationId);
    const targetAt = pendingDeliveryAt.get(conversationId);
    pendingDeliveryAt.delete(conversationId);
    if (!targetAt) return;
    lastAckedAt.set(conversationId, targetAt);
    void fetch(`/api/chat/conversations/${encodeURIComponent(conversationId)}/delivered`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ at: targetAt }),
      keepalive: true,
    }).catch(() => {});
  }, 220);

  pendingDeliveryTimers.set(conversationId, timer);
}
