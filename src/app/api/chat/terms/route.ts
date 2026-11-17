import { NextResponse } from "next/server";
import { z } from "zod";
import { requireChatActor } from "@/lib/chat/guards";
import { acceptChatTerms } from "@/lib/chat/messages";

const termsSchema = z.object({
  accepted: z.literal(true),
});

export async function POST(request: Request) {
  const authResult = await requireChatActor();
  if (!authResult.ok) return authResult.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = termsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Terms acceptance is required" },
      { status: 400 },
    );
  }

  const acceptedAt = await acceptChatTerms(authResult.user.id);
  return NextResponse.json({
    ok: true,
    chatTermsAcceptedAt: acceptedAt.toISOString(),
  });
}
