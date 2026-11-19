import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const packageName =
    process.env.ANDROID_APP_PACKAGE?.trim() || "REPLACE_WITH_ANDROID_PACKAGE_NAME";
  const rawFingerprints = process.env.ANDROID_SHA256_CERT_FINGERPRINTS?.trim() || "";
  const fingerprints = rawFingerprints
    ? rawFingerprints
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : ["REPLACE_WITH_ANDROID_SHA256_CERT_FINGERPRINT"];

  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
