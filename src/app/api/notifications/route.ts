import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRealtimeActor } from "@/lib/chat/guards";
import {
  listNotificationsForUser,
  markAllNotificationsRead,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const patchBodySchema = z.object({
  action: z.literal("mark_all_read"),
});

export async function GET(request: Request) {
  const authResult = await requireRealtimeActor();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor")?.trim() || null;
  const filter = searchParams.get("filter") === "unread" ? "unread" : "all";
  const rawLimit = Number(searchParams.get("limit") || "20");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 20;

  try {
    const data = await listNotificationsForUser(authResult.user.id, {
      cursor,
      limit,
      filter,
    });
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("Failed to list notifications:", err);
    return NextResponse.json(
      { error: "Failed to list notifications" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const authResult = await requireRealtimeActor();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification action" },
      { status: 400 },
    );
  }

  try {
    const res = await markAllNotificationsRead(authResult.user.id);
    return NextResponse.json(res, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("Failed to mark all notifications read:", err);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }
}
