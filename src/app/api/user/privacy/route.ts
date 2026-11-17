import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { safeRevalidatePath } from "@/lib/cache";

const privacySchema = z.object({
  friendRequestPolicy: z.enum(["EVERYONE", "NOBODY"]).optional(),
  showOnlineStatus: z.boolean().optional(),
  showFriendCount: z.boolean().optional(),
});

export async function PATCH(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = privacySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid privacy settings" },
      { status: 400 },
    );
  }

  const data: {
    friendRequestPolicy?: "EVERYONE" | "NOBODY";
    showOnlineStatus?: boolean;
    showFriendCount?: boolean;
  } = {};

  if (parsed.data.friendRequestPolicy !== undefined) {
    data.friendRequestPolicy = parsed.data.friendRequestPolicy;
  }
  if (parsed.data.showOnlineStatus !== undefined) {
    data.showOnlineStatus = parsed.data.showOnlineStatus;
  }
  if (parsed.data.showFriendCount !== undefined) {
    data.showFriendCount = parsed.data.showFriendCount;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      friendRequestPolicy: true,
      showOnlineStatus: true,
      showFriendCount: true,
    },
  });

  safeRevalidatePath("/settings");
  safeRevalidatePath("/profile");
  safeRevalidatePath(`/u/${session.user.id}`);

  return NextResponse.json({ ok: true, privacy: updated });
}
