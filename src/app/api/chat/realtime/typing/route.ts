import { NextResponse } from "next/server";
import { z } from "zod";
import { requireChatActor } from "@/lib/chat/guards";
import {
  canUserAccessConversation,
  conversationChannel,
  getRealtimeTransport,
} from "@/lib/chat/realtime";
import { checkRateLimit } from "@/lib/rate-limit";

const typingSchema = z.object({
  conversationId: z.string().trim().min(1).max(64),
  isTyping: z.boolean(),
});

const globalThrottle = globalThis as typeof globalThis & {
  __ihyaaTypingThrottle?: Map<string, number>;
};

function getTypingThrottleMap(): Map<string, number> {
  if (!globalThrottle.__ihyaaTypingThrottle) {
    globalThrottle.__ihyaaTypingThrottle = new Map();
  }
  return globalThrottle.__ihyaaTypingThrottle;
}

export async function POST(request: Request) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = typingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const actor = authResult.user;
  if (!actor.showOnlineStatus) {
    return NextResponse.json({ ok: true, suppressed: true });
  }

  const { conversationId, isTyping } = parsed.data;

  const access = await canUserAccessConversation(actor.id, conversationId);
  if (!access.ok) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const throttleKey = `${actor.id}:${conversationId}`;
  const map = getTypingThrottleMap();
  const now = Date.now();
  const prev = map.get(throttleKey) ?? 0;

  if (isTyping && now - prev < 1500) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  const rl = await checkRateLimit(`chat_typing:${actor.id}`, 40, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  map.set(throttleKey, isTyping ? now : 0);

  try {
    await getRealtimeTransport().publish(conversationChannel(conversationId), {
      type: "typing",
      conversationId,
      userId: actor.id,
      isTyping,
      at: now,
    });
  } catch (err) {
    console.error("Failed to publish typing event:", err);
  }

  return NextResponse.json({ ok: true });
}
