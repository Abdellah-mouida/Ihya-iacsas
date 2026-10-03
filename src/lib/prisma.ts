import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string | undefined {
  let url = process.env.DATABASE_URL;
  if (!url) return undefined;

  // Neon pooler requires pgbouncer=true to disable prepared statements and keep connections stable
  if (url.includes("-pooler")) {
    const separator = url.includes("?") ? "&" : "?";
    if (!url.includes("pgbouncer=true")) {
      url = `${url}${separator}pgbouncer=true`;
    }
    if (!url.includes("connection_limit=")) {
      const sep = url.includes("?") ? "&" : "?";
      url = `${url}${sep}connection_limit=25&pool_timeout=30&connect_timeout=30`;
    }
  }
  return url;
}

const databaseUrl = getDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: databaseUrl
      ? {
          db: {
            url: databaseUrl,
          },
        }
      : undefined,
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
