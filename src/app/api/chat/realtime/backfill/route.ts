import { NextResponse } from "next/server";
import { requireChatActor } from "@/lib/chat/guards";
import {
  canUserAccessConversation,
  getAuthorizedChannelsForUser,
} from "@/lib/chat/realtime";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId")?.trim() || null;
  const afterMessageId = url.searchParams.get("afterMessageId")?.trim() || null;
  const sinceRaw = url.searchParams.get("since")?.trim() || null;

  let sinceDate: Date | null = null;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (!Number.isNaN(parsed.getTime())) {
      sinceDate = parsed;
    }
  }

  const userId = authResult.user.id;
  let targetConvIds: string[] = [];

  if (conversationId) {
    const access = await canUserAccessConversation(userId, conversationId);
    if (!access.ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    targetConvIds = [conversationId];
  } else {
    const authz = await getAuthorizedChannelsForUser(userId);
    targetConvIds = authz.conversationIds;
  }

  if (targetConvIds.length === 0) {
    return NextResponse.json({
      serverTime: new Date().toISOString(),
      items: [],
    });
  }

  if (conversationId && afterMessageId) {
    const anchor = await prisma.message.findFirst({
      where: { id: afterMessageId, conversationId },
      select: { id: true, createdAt: true },
    });
    if (anchor) {
      const missed = await prisma.message.findMany({
        where: {
          conversationId,
          OR: [
            { createdAt: { gt: anchor.createdAt } },
            { createdAt: anchor.createdAt, id: { gt: anchor.id } },
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 50,
        select: {
          id: true,
          conversationId: true,
          senderId: true,
          createdAt: true,
          editedAt: true,
          deletedAt: true,
        },
      });
      return NextResponse.json(
        {
          serverTime: new Date().toISOString(),
          items: missed.map((m) => ({
            messageId: m.id,
            conversationId: m.conversationId,
            senderId: m.senderId,
            createdAt: m.createdAt.toISOString(),
            editedAt: m.editedAt?.toISOString() ?? null,
            deletedAt: m.deletedAt?.toISOString() ?? null,
          })),
        },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }
  }

  const fallbackSince =
    sinceDate ?? new Date(Date.now() - 5 * 60 * 1000);

  const missed = await prisma.message.findMany({
    where: {
      conversationId: { in: targetConvIds },
      createdAt: { gt: fallbackSince },
    },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 50,
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      createdAt: true,
      editedAt: true,
      deletedAt: true,
    },
  });

  return NextResponse.json(
    {
      serverTime: new Date().toISOString(),
      items: missed.map((m) => ({
        messageId: m.id,
        conversationId: m.conversationId,
        senderId: m.senderId,
        createdAt: m.createdAt.toISOString(),
        editedAt: m.editedAt?.toISOString() ?? null,
        deletedAt: m.deletedAt?.toISOString() ?? null,
      })),
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
