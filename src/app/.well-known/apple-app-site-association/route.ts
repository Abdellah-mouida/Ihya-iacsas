import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const appId =
    process.env.APPLE_APP_ID?.trim() ||
    "REPLACE_WITH_APPLE_TEAM_ID.REPLACE_WITH_BUNDLE_ID";

  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [appId],
            components: [
              { "/": "/chat/invite/*" },
              { "/": "/events/*" },
              { "/": "/u/*" },
              { "/": "/notifications" },
            ],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
