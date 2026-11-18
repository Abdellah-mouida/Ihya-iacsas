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
  getPublicProfile,
  sendFriendRequest,
  unblockUser,
  unfriendUser,
} from "@/lib/chat/friends";
import { userChannel } from "@/lib/chat/realtime/types";
import { notify } from "@/lib/notifications";
import { publishChange } from "@/lib/realtime/publish";

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

export async function GET(request: Request) {
  const authResult = await requireChatActor();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const profileId = searchParams.get("profileId")?.trim();

  try {
    if (profileId) {
      const profile = await getPublicProfile(authResult.user.id, profileId);
      if (!profile) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      return NextResponse.json(
        { profile },
        { headers: { "Cache-Control": "no-store, max-age=0" } },
      );
    }

    const data = await getFriendsDashboardData(authResult.user.id);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
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

    const kindMap = {
      send: result.autoAccepted ? "accepted" : "requested",
      cancel: "canceled",
      accept: "accepted",
      decline: "declined",
      unfriend: "unfriended",
      block: "blocked",
      unblock: "unblocked",
    } as const;

    const kind = kindMap[action];
    const channels = [userChannel(targetUserId), userChannel(actorId)];
    await Promise.all([
      publishChange(channels, {
        type: "friend.changed",
        kind,
        actorId,
      }),
      publishChange(channels, {
        type: "unread.sync",
      }),
    ]);

    if (action === "send") {
      if (result.autoAccepted) {
        await notify(targetUserId, "FRIEND_REQUEST_ACCEPTED", {
          params: { actorName: authResult.user.name ?? "" },
          data: { actorId },
          dedupeKey: `friend-accept:${actorId}:${targetUserId}`,
        });
      } else if (!result.alreadyExists) {
        await notify(targetUserId, "FRIEND_REQUEST_RECEIVED", {
          params: { actorName: authResult.user.name ?? "" },
          data: { actorId },
          dedupeKey: `friend-req:${actorId}:${targetUserId}`,
        });
      }
    } else if (action === "accept") {
      await notify(targetUserId, "FRIEND_REQUEST_ACCEPTED", {
        params: { actorName: authResult.user.name ?? "" },
        data: { actorId },
        dedupeKey: `friend-accept:${actorId}:${targetUserId}`,
      });
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
