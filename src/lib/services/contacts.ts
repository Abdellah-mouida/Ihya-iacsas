import { logActivity } from "@/lib/audit";
import { can, ForbiddenError, UnauthorizedError } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

export interface ContactActor {
  id: string;
  role: string;
}

export async function submitContactMessageService(params: {
  name: string;
  email: string;
  message: string;
  ip: string;
}): Promise<
  | { success: true; contact: { id: string; name: string; email: string; message: string; createdAt: Date } }
  | { success: false; error: string; status: number }
> {
  const rate = await checkRateLimit(`contact:${params.ip.slice(0, 64)}`, 5, 600);
  if (!rate.allowed) {
    return {
      success: false,
      status: 429,
      error: "Too many messages sent recently. Please try again later.",
    };
  }

  const name = params.name.trim();
  const email = params.email.trim().toLowerCase();
  const message = params.message.trim();

  if (!name || !email || !message) {
    return { success: false, status: 400, error: "Please fill in all fields" };
  }
  if (
    name.length > 120 ||
    email.length > 254 ||
    message.length < 3 ||
    message.length > 2000
  ) {
    return {
      success: false,
      status: 400,
      error: "Input length is out of allowed bounds",
    };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, status: 400, error: "Invalid email address" };
  }

  const contact = await prisma.contactMessage.create({
    data: { name, email, message },
    select: {
      id: true,
      name: true,
      email: true,
      message: true,
      createdAt: true,
    },
  });

  return { success: true, contact };
}

export async function listContactMessagesForActor(
  actor: ContactActor | null,
  options?: { skip?: number; take?: number },
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "contacts:view")) throw new ForbiddenError();

  const take = options?.take ? Math.min(100, Math.max(1, options.take)) : undefined;
  const skip = options?.skip ? Math.max(0, options.skip) : undefined;

  const [messages, total] = await Promise.all([
    prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    }),
    prisma.contactMessage.count(),
  ]);

  return { messages, total };
}

export async function deleteContactMessageForActor(
  actor: ContactActor | null,
  id: string,
) {
  if (!actor?.id) throw new UnauthorizedError();
  if (!can(actor.role, "contacts:manage")) throw new ForbiddenError();

  const existing = await prisma.contactMessage.findUnique({
    where: { id },
    select: { name: true, email: true },
  });

  await prisma.contactMessage.delete({ where: { id } });

  await logActivity({
    actorId: actor.id,
    action: "CONTACT_DELETE",
    targetType: "ContactMessage",
    targetId: id,
    details: {
      name: existing?.name,
      email: existing?.email,
    },
  });
}
