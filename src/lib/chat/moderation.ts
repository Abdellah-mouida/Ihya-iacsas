import { z } from "zod";
import { logActivity } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { decryptMessage, encryptMessage, loadKeyringFromEnv } from "./crypto-core";
import { ChatServiceError } from "./friends";
import { getRealtimeTransport } from "./realtime";
import { canUserAccessConversation } from "./realtime/channels";
import { conversationChannel, userChannel } from "./realtime/types";

export const reportMessageSchema = z.object({
  messageId: z.string().min(1).max(64),
  reason: z.string().trim().min(3).max(500),
});

export const resolveReportSchema = z.object({
  status: z.enum(["RESOLVED", "DISMISSED"]),
  resolutionNote: z.string().trim().max(300).optional(),
});

export const timeoutUserSchema = z.object({
  hours: z.number().int().min(0).max(720),
  reason: z.string().trim().max(300).optional(),
});

export const banUserSchema = z.object({
  banned: z.boolean(),
  reason: z.string().trim().max(300).optional(),
});

export const toggleChatEnabledSchema = z.object({
  enabled: z.boolean(),
});

export const moderateDeleteMessageSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});

export interface ModerationActor {
  id: string;
  name: string | null;
  email: string | null;
  role: "ADMIN" | "MODERATOR";
}

function splitSnapshotSubject(
  snapshotAadSubject: string,
  fallbackMessageId: string | null,
): { messageId: string; senderId: string } {
  const idx = snapshotAadSubject.indexOf(":");
  if (idx > 0) {
    return {
      messageId: snapshotAadSubject.slice(0, idx),
      senderId: snapshotAadSubject.slice(idx + 1) || "system",
    };
  }
  return {
    messageId: fallbackMessageId ?? "",
    senderId: snapshotAadSubject || "system",
  };
}

export async function reportMessage(params: {
  reporterId: string;
  reporterName?: string | null;
  reporterRole?: string | null;
  messageId: string;
  reason: string;
}) {
  const parsed = reportMessageSchema.safeParse({
    messageId: params.messageId,
    reason: params.reason,
  });
  if (!parsed.success) {
    throw new ChatServiceError("Invalid report details", 400, "VALIDATION_ERROR");
  }

  const rl = await checkRateLimit(
    `chat:report:${params.reporterId}`,
    15,
    24 * 60 * 60,
  );
  if (!rl.allowed) {
    throw new ChatServiceError(
      "Daily report limit reached",
      429,
      "RATE_LIMITED",
    );
  }

  const message = await prisma.message.findUnique({
    where: { id: parsed.data.messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      isAnonymized: true,
      type: true,
      ciphertext: true,
      nonce: true,
      keyVersion: true,
      deletedAt: true,
      conversation: {
        select: { type: true },
      },
    },
  });

  if (!message || message.deletedAt || message.type === "SYSTEM") {
    throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
  }

  const access = await canUserAccessConversation(
    params.reporterId,
    message.conversationId,
  );
  if (!access.ok) {
    throw new ChatServiceError("Message not found", 404, "NOT_FOUND");
  }

  if (message.senderId && message.senderId === params.reporterId) {
    throw new ChatServiceError(
      "Cannot report your own message",
      400,
      "CANNOT_REPORT_SELF",
    );
  }

  const existingOpen = await prisma.report.findFirst({
    where: {
      reporterId: params.reporterId,
      messageId: message.id,
      status: "OPEN",
    },
    select: { id: true },
  });
  if (existingOpen) {
    throw new ChatServiceError(
      "You already reported this message",
      409,
      "ALREADY_REPORTED",
    );
  }

  const keyring = loadKeyringFromEnv();
  const messageSenderAad = message.isAnonymized
    ? "anonymized"
    : (message.senderId ?? "");
  const plaintext = decryptMessage(
    {
      ciphertext: message.ciphertext,
      nonce: message.nonce,
      keyVersion: message.keyVersion,
      conversationId: message.conversationId,
      messageId: message.id,
      senderId: messageSenderAad,
    },
    keyring,
  );

  const snapshotAadSubject = `${message.id}:${messageSenderAad}`;
  const encryptedSnapshot = encryptMessage(
    {
      plaintext,
      conversationId: message.conversationId,
      messageId: message.id,
      senderId: snapshotAadSubject,
    },
    keyring,
  );

  const report = await prisma.report.create({
    data: {
      reporterId: params.reporterId,
      reportedUserId: message.senderId,
      conversationId: message.conversationId,
      messageId: message.id,
      reason: parsed.data.reason,
      snapshotCiphertext: encryptedSnapshot.ciphertext,
      snapshotNonce: encryptedSnapshot.nonce,
      snapshotKeyVersion: encryptedSnapshot.keyVersion,
      snapshotAadSubject,
    },
    select: {
      id: true,
      status: true,
      createdAt: true,
    },
  });

  await logActivity({
    actorId: params.reporterId,
    actorName: params.reporterName ?? null,
    actorRole: params.reporterRole ?? "USER",
    action: "CHAT_REPORT_CREATE",
    targetType: "CHAT_REPORT",
    targetId: report.id,
    details: {
      conversationId: message.conversationId,
      conversationType: message.conversation.type,
      reportedUserId: message.senderId ?? null,
    },
  });

  return report;
}

export async function listChatModerationDashboard(params?: {
  status?: "OPEN" | "RESOLVED" | "DISMISSED" | "ALL";
  search?: string;
}) {
  const statusFilter = params?.status ?? "OPEN";
  const searchTerm = params?.search?.trim() ?? "";

  const [setting, statusCounts, reports, matchedUsers] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { key: "chatEnabled" },
      select: { value: true },
    }),
    prisma.report.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.report.findMany({
      where: statusFilter === "ALL" ? undefined : { status: statusFilter },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        reason: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        resolutionNote: true,
        conversationId: true,
        messageId: true,
        snapshotCiphertext: true,
        snapshotNonce: true,
        snapshotKeyVersion: true,
        snapshotAadSubject: true,
        conversation: {
          select: { id: true, type: true, name: true },
        },
        message: {
          select: { id: true, deletedAt: true },
        },
        reporter: {
          select: { id: true, name: true, email: true },
        },
        reportedUser: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            chatPublicTimeoutUntil: true,
            chatBannedAt: true,
            chatBannedReason: true,
          },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
    }),
    searchTerm.length >= 2
      ? prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: searchTerm, mode: "insensitive" } },
              { email: { contains: searchTerm, mode: "insensitive" } },
            ],
          },
          take: 15,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            chatPublicTimeoutUntil: true,
            chatBannedAt: true,
            chatBannedReason: true,
          },
        })
      : Promise.resolve([]),
  ]);

  let keyring: ReturnType<typeof loadKeyringFromEnv> | null = null;
  try {
    keyring = loadKeyringFromEnv();
  } catch {
    keyring = null;
  }

  const counts = { OPEN: 0, RESOLVED: 0, DISMISSED: 0 };
  for (const row of statusCounts) {
    counts[row.status] = row._count._all;
  }

  const serializedReports = reports.map((r) => {
    let snapshotBody: string | null = null;
    if (keyring && r.snapshotCiphertext && r.snapshotNonce) {
      try {
        const subject = splitSnapshotSubject(r.snapshotAadSubject, r.messageId);
        snapshotBody = decryptMessage(
          {
            ciphertext: r.snapshotCiphertext,
            nonce: r.snapshotNonce,
            keyVersion: r.snapshotKeyVersion,
            conversationId: r.conversationId,
            messageId: subject.messageId,
            senderId: r.snapshotAadSubject,
          },
          keyring,
        );
      } catch {
        snapshotBody = null;
      }
    }

    return {
      id: r.id,
      reason: r.reason,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
      resolutionNote: r.resolutionNote,
      conversation: r.conversation,
      messageId: r.messageId,
      messageDeleted: r.message ? Boolean(r.message.deletedAt) : true,
      snapshotBody,
      reporter: r.reporter,
      reportedUser: r.reportedUser
        ? {
            id: r.reportedUser.id,
            name: r.reportedUser.name,
            email: r.reportedUser.email,
            role: r.reportedUser.role,
            chatPublicTimeoutUntil: r.reportedUser.chatPublicTimeoutUntil
              ? r.reportedUser.chatPublicTimeoutUntil.toISOString()
              : null,
            chatBannedAt: r.reportedUser.chatBannedAt
              ? r.reportedUser.chatBannedAt.toISOString()
              : null,
            chatBannedReason: r.reportedUser.chatBannedReason,
          }
        : null,
      reviewedBy: r.reviewedBy,
    };
  });

  return {
    chatEnabled: setting?.value === "true",
    counts,
    reports: serializedReports,
    users: matchedUsers.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      chatPublicTimeoutUntil: u.chatPublicTimeoutUntil
        ? u.chatPublicTimeoutUntil.toISOString()
        : null,
      chatBannedAt: u.chatBannedAt ? u.chatBannedAt.toISOString() : null,
      chatBannedReason: u.chatBannedReason,
    })),
  };
}

export async function resolveChatReport(params: {
  reportId: string;
  actor: ModerationActor;
  status: "RESOLVED" | "DISMISSED";
  resolutionNote?: string;
}) {
  const parsed = resolveReportSchema.safeParse({
    status: params.status,
    resolutionNote: params.resolutionNote,
  });
  if (!parsed.success) {
    throw new ChatServiceError("Invalid resolution input", 400, "VALIDATION_ERROR");
  }

  const existing = await prisma.report.findUnique({
    where: { id: params.reportId },
    select: { id: true, reportedUserId: true, conversationId: true },
  });
  if (!existing) {
    throw new ChatServiceError("Report not found", 404, "NOT_FOUND");
  }

  const updated = await prisma.report.update({
    where: { id: existing.id },
    data: {
      status: parsed.data.status,
      reviewedById: params.actor.id,
      reviewedAt: new Date(),
      resolutionNote: parsed.data.resolutionNote || null,
    },
    select: {
      id: true,
      status: true,
      reviewedAt: true,
      resolutionNote: true,
    },
  });

  await logActivity({
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: "CHAT_REPORT_RESOLVE",
    targetType: "CHAT_REPORT",
    targetId: updated.id,
    details: {
      status: updated.status,
      conversationId: existing.conversationId,
      reportedUserId: existing.reportedUserId ?? null,
    },
  });

  return updated;
}

export async function moderateDeletePublicMessage(params: {
  messageId: string;
  actor: ModerationActor;
  reason?: string;
}) {
  const parsed = moderateDeleteMessageSchema.safeParse({
    reason: params.reason,
  });
  if (!parsed.success) {
    throw new ChatServiceError("Invalid moderation note", 400, "VALIDATION_ERROR");
  }

  const message = await prisma.message.findUnique({
    where: { id: params.messageId },
    select: {
      id: true,
      conversationId: true,
      senderId: true,
      deletedAt: true,
      conversation: { select: { type: true } },
    },
  });

  if (!message || message.conversation.type !== "PUBLIC") {
    throw new ChatServiceError(
      "Only public space messages can be deleted by moderators",
      404,
      "NOT_FOUND",
    );
  }

  if (message.deletedAt) {
    return { id: message.id, deletedAt: message.deletedAt.toISOString() };
  }

  const now = new Date();
  await prisma.message.update({
    where: { id: message.id },
    data: {
      deletedAt: now,
      ciphertext: "",
      nonce: "",
    },
  });

  await logActivity({
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: "CHAT_PUBLIC_MESSAGE_DELETE",
    targetType: "CHAT_MESSAGE",
    targetId: message.id,
    details: {
      conversationId: message.conversationId,
      messageSenderId: message.senderId ?? null,
      reason: parsed.data.reason || null,
    },
  });

  await getRealtimeTransport().publish(
    conversationChannel(message.conversationId),
    {
      type: "message.deleted",
      conversationId: message.conversationId,
      messageId: message.id,
      senderId: message.senderId ?? params.actor.id,
      deletedAt: now.toISOString(),
    },
  );

  return { id: message.id, deletedAt: now.toISOString() };
}

function assertModerationTargetAllowed(
  actor: ModerationActor,
  target: { id: string; role: string },
) {
  if (target.id === actor.id) {
    throw new ChatServiceError(
      "Cannot moderate your own account",
      400,
      "CANNOT_MODERATE_SELF",
    );
  }
  if (target.role === "ADMIN") {
    throw new ChatServiceError(
      "Cannot moderate an administrator",
      403,
      "FORBIDDEN",
    );
  }
  if (actor.role === "MODERATOR" && target.role === "MODERATOR") {
    throw new ChatServiceError(
      "Moderators cannot moderate other moderators",
      403,
      "FORBIDDEN",
    );
  }
}

export async function timeoutUserFromPublicChat(params: {
  targetUserId: string;
  hours: number;
  actor: ModerationActor;
  reason?: string;
}) {
  const parsed = timeoutUserSchema.safeParse({
    hours: params.hours,
    reason: params.reason,
  });
  if (!parsed.success) {
    throw new ChatServiceError("Invalid timeout duration", 400, "VALIDATION_ERROR");
  }

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!target) {
    throw new ChatServiceError("User not found", 404, "NOT_FOUND");
  }
  assertModerationTargetAllowed(params.actor, target);

  const until =
    parsed.data.hours > 0
      ? new Date(Date.now() + parsed.data.hours * 3_600_000)
      : null;

  await prisma.user.update({
    where: { id: target.id },
    data: { chatPublicTimeoutUntil: until },
  });

  await logActivity({
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: "CHAT_PUBLIC_TIMEOUT",
    targetType: "USER",
    targetId: target.id,
    targetName: target.name,
    targetEmail: target.email,
    details: {
      hours: parsed.data.hours,
      until: until ? until.toISOString() : null,
      reason: parsed.data.reason || null,
    },
  });

  const publicConv = await prisma.conversation.findUnique({
    where: { publicKey: "PUBLIC" },
    select: { id: true },
  });
  if (publicConv) {
    await getRealtimeTransport().publish(userChannel(target.id), {
      type: "member.changed",
      conversationId: publicConv.id,
      action: "moderation",
      userId: target.id,
    });
  }

  return {
    userId: target.id,
    chatPublicTimeoutUntil: until ? until.toISOString() : null,
  };
}

export async function setUserChatBan(params: {
  targetUserId: string;
  banned: boolean;
  actor: ModerationActor;
  reason?: string;
}) {
  const parsed = banUserSchema.safeParse({
    banned: params.banned,
    reason: params.reason,
  });
  if (!parsed.success) {
    throw new ChatServiceError("Invalid ban input", 400, "VALIDATION_ERROR");
  }

  const target = await prisma.user.findUnique({
    where: { id: params.targetUserId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!target) {
    throw new ChatServiceError("User not found", 404, "NOT_FOUND");
  }
  assertModerationTargetAllowed(params.actor, target);

  const bannedAt = parsed.data.banned ? new Date() : null;
  const bannedReason = parsed.data.banned
    ? parsed.data.reason || "Community guidelines violation"
    : null;

  await prisma.user.update({
    where: { id: target.id },
    data: {
      chatBannedAt: bannedAt,
      chatBannedReason: bannedReason,
    },
  });

  await logActivity({
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: parsed.data.banned ? "CHAT_USER_BAN" : "CHAT_USER_UNBAN",
    targetType: "USER",
    targetId: target.id,
    targetName: target.name,
    targetEmail: target.email,
    details: {
      reason: bannedReason,
    },
  });

  const publicConv = await prisma.conversation.findUnique({
    where: { publicKey: "PUBLIC" },
    select: { id: true },
  });
  if (publicConv) {
    await getRealtimeTransport().publish(userChannel(target.id), {
      type: "member.changed",
      conversationId: publicConv.id,
      action: parsed.data.banned ? "banned" : "unbanned",
      userId: target.id,
    });
  }

  return {
    userId: target.id,
    chatBannedAt: bannedAt ? bannedAt.toISOString() : null,
    chatBannedReason: bannedReason,
  };
}

export async function setGlobalChatEnabled(params: {
  enabled: boolean;
  actor: ModerationActor;
}) {
  const parsed = toggleChatEnabledSchema.safeParse({ enabled: params.enabled });
  if (!parsed.success) {
    throw new ChatServiceError("Invalid setting value", 400, "VALIDATION_ERROR");
  }

  const value = parsed.data.enabled ? "true" : "false";
  await prisma.systemSetting.upsert({
    where: { key: "chatEnabled" },
    update: { value },
    create: { key: "chatEnabled", value },
  });

  await logActivity({
    actorId: params.actor.id,
    actorName: params.actor.name,
    actorEmail: params.actor.email,
    actorRole: params.actor.role,
    action: "CHAT_SETTINGS_TOGGLE",
    targetType: "SYSTEM_SETTING",
    targetId: "chatEnabled",
    details: { chatEnabled: parsed.data.enabled },
  });

  return { chatEnabled: parsed.data.enabled };
}
