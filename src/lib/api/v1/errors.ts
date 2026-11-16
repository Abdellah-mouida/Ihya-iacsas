import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { ChatServiceError } from "@/lib/chat/friends";
import { ForbiddenError, UnauthorizedError } from "@/lib/permissions";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, string[]>;
  headers?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    options?: {
      details?: Record<string, string[]>;
      headers?: Record<string, string>;
    },
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = options?.details;
    this.headers = options?.headers;
  }
}

export function jsonOk<T>(
  data: T,
  init?: { status?: number; headers?: Record<string, string>; cacheControl?: string },
): NextResponse {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", init?.cacheControl ?? "no-store, max-age=0");
  return NextResponse.json(data, {
    status: init?.status ?? 200,
    headers,
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  options?: {
    details?: Record<string, string[]>;
    headers?: Record<string, string>;
  },
): NextResponse {
  const headers = new Headers(options?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options?.details ? { details: options.details } : {}),
      },
    },
    { status, headers },
  );
}

function formatZodIssues(err: ZodError): Record<string, string[]> {
  const details: Record<string, string[]> = {};
  for (const issue of err.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_root";
    if (!details[key]) details[key] = [];
    details[key].push(issue.message);
  }
  return details;
}

export function handleApiError(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return jsonError(err.status, err.code, err.message, {
      details: err.details,
      headers: err.headers,
    });
  }

  if (err instanceof ChatServiceError) {
    return jsonError(err.status, err.code, err.message);
  }

  if (err instanceof UnauthorizedError) {
    return jsonError(401, "UNAUTHORIZED", "Authentication required");
  }

  if (err instanceof ForbiddenError) {
    return jsonError(403, "FORBIDDEN", "Insufficient permissions");
  }

  if (err instanceof ZodError) {
    return jsonError(400, "VALIDATION_ERROR", "Invalid request payload", {
      details: formatZodIssues(err),
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return jsonError(409, "CONFLICT", "Resource already exists");
    }
    if (err.code === "P2025") {
      return jsonError(404, "NOT_FOUND", "Resource not found");
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.error("[api/v1] Unhandled error:", err);
  }

  return jsonError(500, "INTERNAL_ERROR", "An unexpected error occurred");
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Request body must be valid JSON");
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError(400, "VALIDATION_ERROR", "Invalid request payload", {
      details: formatZodIssues(parsed.error),
    });
  }
  return parsed.data;
}

export function parsePagination(
  url: URL,
  options?: { defaultLimit?: number; maxLimit?: number },
): { page: number; limit: number; skip: number } {
  const defaultLimit = options?.defaultLimit ?? 20;
  const maxLimit = options?.maxLimit ?? 50;

  const rawPage = Number(url.searchParams.get("page") ?? "1");
  const rawLimit = Number(url.searchParams.get("limit") ?? String(defaultLimit));

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1;
  const limit = Number.isFinite(rawLimit)
    ? Math.min(maxLimit, Math.max(1, Math.trunc(rawLimit)))
    : defaultLimit;

  return { page, limit, skip: (page - 1) * limit };
}
