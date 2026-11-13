import { NextResponse } from "next/server";
import { z } from "zod";
import { requireChatActor } from "@/lib/chat/guards";
import {
  acceptFriendRequest,
  blockUser,
  cancelFriendRequest,
  ChatServiceError,
  declineFriendRequest,
  getFriendsDashboardData,
  sendFriendRequest,
  unblockUser,
  unfriendUser,
} from "@/lib/chat/friends";

const friendActionSchema = z.object({
  action: z.enum([
    "send",
    "cancel",
    "accept",
    "decline",
    "unfriend",
    "block",
    "unblock",
  ]),
  targetUserId: z.string().trim().min(1).max(64),
});

export async function GET() {
  const authResult = await requireChatActor();
  if (!authResult.ok) return authResult.response;

  try {
    const data = await getFriendsDashboardData(authResult.user.id);
    return NextResponse.json(data);
  } catch (err) {
    console.error("Failed to fetch friends dashboard:", err);
    return NextResponse.json(
      { error: "Failed to load friends" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireChatActor();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = friendActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid friend request payload" },
      { status: 400 },
    );
  }

  const { action, targetUserId } = parsed.data;
  const actorId = authResult.user.id;

  try {
    let result: Record<string, unknown>;
    switch (action) {
      case "send":
        result = await sendFriendRequest(actorId, targetUserId);
        break;
      case "cancel":
        result = await cancelFriendRequest(actorId, targetUserId);
        break;
      case "accept":
        result = await acceptFriendRequest(actorId, targetUserId);
        break;
      case "decline":
        result = await declineFriendRequest(actorId, targetUserId);
        break;
      case "unfriend":
        result = await unfriendUser(actorId, targetUserId);
        break;
      case "block":
        result = await blockUser(actorId, targetUserId);
        break;
      case "unblock":
        result = await unblockUser(actorId, targetUserId);
        break;
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("Friend action failed:", err);
    return NextResponse.json(
      { error: "Friend action failed" },
      { status: 500 },
    );
  }
}
