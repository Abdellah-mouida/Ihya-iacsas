import { NextResponse } from "next/server";
import { requireChatActor } from "@/lib/chat/guards";
import { ChatServiceError, searchUsersByNamePrefix } from "@/lib/chat/friends";

export async function GET(request: Request) {
  const authResult = await requireChatActor();
  if (!authResult.ok) return authResult.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") || "";

  try {
    const users = await searchUsersByNamePrefix(authResult.user.id, query);
    return NextResponse.json({ users });
  } catch (err) {
    if (err instanceof ChatServiceError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status },
      );
    }
    console.error("User prefix search failed:", err);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
