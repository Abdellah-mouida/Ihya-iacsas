import { NextResponse } from "next/server";
import { handleApiError, jsonError } from "./errors";

const ALLOWED_METHODS = "GET, POST, PATCH, PUT, DELETE, OPTIONS";
const ALLOWED_HEADERS =
  "Content-Type, Authorization, X-Device-Name, X-Client-Platform, X-Realtime-Token";

function parseAllowedOrigins(): Set<string> {
  const raw = process.env.API_ALLOWED_ORIGINS ?? "";
  const origins = new Set<string>();
  for (const item of raw.split(",")) {
    const trimmed = item.trim();
    if (!trimmed || trimmed === "*") continue;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        origins.add(parsed.origin);
      }
    } catch {
      // ignore malformed origin entries
    }
  }
  return origins;
}

export function evaluateCorsOrigin(request: Request): {
  allowed: boolean;
  origin: string | null;
} {
  const originHeader = request.headers.get("origin");
  if (!originHeader) {
    return { allowed: true, origin: null };
  }

  let normalizedOrigin: string;
  try {
    const parsed = new URL(originHeader);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { allowed: false, origin: null };
    }
    normalizedOrigin = parsed.origin;
  } catch {
    return { allowed: false, origin: null };
  }

  const allowedOrigins = parseAllowedOrigins();
  if (allowedOrigins.has(normalizedOrigin)) {
    return { allowed: true, origin: normalizedOrigin };
  }

  return { allowed: false, origin: null };
}

export function applyCorsHeaders<T extends Response>(
  response: T,
  origin: string | null,
): T {
  response.headers.set("Vary", "Origin");
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
    response.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
    response.headers.set("Access-Control-Max-Age", "86400");
  }
  return response;
}

export function handleCorsPreflight(request: Request): NextResponse {
  const cors = evaluateCorsOrigin(request);
  if (!cors.allowed) {
    const res = jsonError(403, "CORS_FORBIDDEN", "Origin is not allowed");
    res.headers.set("Vary", "Origin");
    return res;
  }

  const res = new NextResponse(null, { status: 204 });
  return applyCorsHeaders(res, cors.origin);
}

export async function withV1(
  request: Request,
  handler: () => Promise<Response>,
): Promise<Response> {
  const cors = evaluateCorsOrigin(request);
  if (!cors.allowed) {
    const res = jsonError(403, "CORS_FORBIDDEN", "Origin is not allowed");
    res.headers.set("Vary", "Origin");
    return res;
  }

  try {
    const response = await handler();
    return applyCorsHeaders(response, cors.origin);
  } catch (err) {
    const response = handleApiError(err);
    return applyCorsHeaders(response, cors.origin);
  }
}
