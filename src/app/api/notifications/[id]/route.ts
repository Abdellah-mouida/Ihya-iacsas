import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRealtimeActor } from "@/lib/chat/guards";
import {
  getNotificationForUser,
  setNotificationReadState,
} from "@/lib/notifications";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  read: z.boolean(),
});

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRealtimeActor();
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const notification = await getNotificationForUser(
      authResult.user.id,
      id.trim(),
    );
    if (!notification) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { notification },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (err) {
    console.error("Failed to read notification:", err);
    return NextResponse.json(
      { error: "Failed to read notification" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const authResult = await requireRealtimeActor();
  if (!authResult.ok) return authResult.response;

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid notification update payload" },
      { status: 400 },
    );
  }

  try {
    const result = await setNotificationReadState(
      authResult.user.id,
      id.trim(),
      parsed.data.read,
    );
    if (!result) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (err) {
    console.error("Failed to update notification read state:", err);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 },
    );
  }
}
