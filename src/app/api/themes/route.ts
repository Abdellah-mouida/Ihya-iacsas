import { NextResponse } from "next/server";
import { getCachedEnabledThemes } from "@/lib/theme-server";

export async function GET() {
  try {
    const themes = await getCachedEnabledThemes();
    return NextResponse.json({ success: true, themes });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: "Failed to fetch themes" },
      { status: 500 }
    );
  }
}
