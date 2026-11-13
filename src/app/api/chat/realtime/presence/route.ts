import { NextResponse } from "next/server";
import { z } from "zod";
import { requireChatActor } from "@/lib/chat/guards";
import {
  getLocalOnlineUserIds,
  updateLocalPresence,
} from "@/lib/chat/realtime/local-sse";
import { getRealtimeProviderKind } from "@/lib/chat/realtime";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { touchUserActive } from "@/lib/activity";

const presenceSchema = z.object({
  online: z.boolean().default(true),
});

export async function GET() {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const recentUsers = await prisma.user.findMany({
    where: {
      showOnlineStatus: true,
      chatBannedAt: null,
      lastActiveAt: { gte: twoMinutesAgo },
    },
    select: { id: true },
    take: 200,
  });

  const merged = new Set(recentUsers.map((u) => u.id));
  if (getRealtimeProviderKind() === "local") {
    for (const id of getLocalOnlineUserIds()) {
      merged.add(id);
    }
  }

  return NextResponse.json(
    { onlineUserIds: Array.from(merged) },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function POST(request: Request) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = presenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const actor = authResult.user;
  const rl = await checkRateLimit(`chat_presence:${actor.id}`, 30, 60);
  if (!rl.allowed) {
    return NextResponse.json({ ok: true, throttled: true });
  }

  if (parsed.data.online && actor.showOnlineStatus) {
    await touchUserActive(actor.id);
  }

  let onlineUserIds: string[] = [];
  if (getRealtimeProviderKind() === "local") {
    onlineUserIds = updateLocalPresence(
      actor.id,
      parsed.data.online,
      actor.showOnlineStatus,
    );
  }

  return NextResponse.json({
    ok: true,
    suppressed: !actor.showOnlineStatus,
    onlineUserIds,
  });
}
