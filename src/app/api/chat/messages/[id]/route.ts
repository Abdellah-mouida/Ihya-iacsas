import { NextResponse } from "next/server";
import { z } from "zod";
import { ChatServiceError } from "@/lib/chat/friends";
import { requireChatActor } from "@/lib/chat/guards";
import {
  deleteMessage,
  editMessage,
  getConversationMessageById,
  MAX_MESSAGE_LENGTH,
} from "@/lib/chat/messages";

const editSchema = z.object({
  body: z.string().max(MAX_MESSAGE_LENGTH + 200),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  try {
    const message = await getConversationMessageById({
      userId: authResult.user.id,
      messageId: id,
    });
    return NextResponse.json(
      { message },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to fetch message" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = editSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid edit payload" },
      { status: 400 },
    );
  }

  try {
    const message = await editMessage({
      userId: authResult.user.id,
      messageId: id,
      body: parsed.data.body,
    });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to update message" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireChatActor({ requireTerms: true });
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id || id.length > 64) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  try {
    const message = await deleteMessage({
      userId: authResult.user.id,
      messageId: id,
    });
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    return NextResponse.json(
      { error: "Failed to delete message" },
      { status: 500 },
    );
  }
}
