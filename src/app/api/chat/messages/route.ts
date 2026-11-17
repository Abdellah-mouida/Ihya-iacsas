import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatServiceError } from "@/lib/chat/friends";
import { requireChatActor } from "@/lib/chat/guards";
import {
  DEFAULT_PAGE_SIZE,
  getConversationMessages,
  MAX_MESSAGE_LENGTH,
  MAX_PAGE_SIZE,
  sendMessage,
} from "@/lib/chat/messages";

const sendSchema = z.object({
  conversationId: z.string().trim().min(1).max(64),
  body: z.string().max(MAX_MESSAGE_LENGTH + 200),
  clientId: z.string().trim().min(1).max(100).optional(),
  replyToId: z.string().trim().min(1).max(64).optional().nullable(),
});

export async function GET(request: Request) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId")?.trim() ?? "";
  if (!conversationId || conversationId.length > 64) {
    return NextResponse.json(
      { error: "Conversation not found" },
      { status: 404 },
    );
  }

  const cursor = searchParams.get("cursor")?.trim() || null;
  const rawLimit = Number(searchParams.get("limit") ?? DEFAULT_PAGE_SIZE);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(rawLimit)))
    : DEFAULT_PAGE_SIZE;

  try {
    const result = await getConversationMessages({
      userId: authResult.user.id,
      conversationId,
      cursor,
      limit,
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid message payload" },
      { status: 400 },
    );
  }

  try {
    const result = await sendMessage({
      userId: authResult.user.id,
      conversationId: parsed.data.conversationId,
      body: parsed.data.body,
      clientId: parsed.data.clientId,
      replyToId: parsed.data.replyToId,
      publicTimeoutUntil: authResult.user.chatPublicTimeoutUntil,
    });
    return NextResponse.json(
      { message: result.message },
      { status: result.deduplicated ? 200 : 201 },
    );
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 },
    );
  }
}
