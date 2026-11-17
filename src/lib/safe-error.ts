export function safeActionError(
  error: unknown,
  fallback: string,
  allowedMessages?: readonly string[],
): string {
  if (error instanceof Error) {
    if (error.name === "UnauthorizedError") {
      return "Unauthorized";
    }
    if (error.name === "ForbiddenError") {
      return "Forbidden";
    }
    if (allowedMessages && allowedMessages.includes(error.message)) {
      return error.message;
    }
  }
  return fallback;
}
