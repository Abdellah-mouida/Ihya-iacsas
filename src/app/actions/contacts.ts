"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { logActivity } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";
import { safeActionError } from "@/lib/safe-error";

export async function submitContactMessage(data: {
  name: string;
  email: string;
  message: string;
}) {
  try {
    const hdrs = await headers();
    const rawIp =
      hdrs.get("x-vercel-forwarded-for") ||
      hdrs.get("x-real-ip") ||
      hdrs.get("x-forwarded-for")?.split(",").pop() ||
      "unknown";
    const ip = rawIp.trim().slice(0, 64) || "unknown";
    const rate = await checkRateLimit(`contact:${ip}`, 5, 600);
    if (!rate.allowed) {
      return {
        success: false,
        error: "Too many messages sent recently. Please try again later.",
      };
    }

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";

    if (!name || !email || !message) {
      return { success: false, error: "Please fill in all fields" };
    }
    if (name.length > 120 || email.length > 254 || message.length < 3 || message.length > 2000) {
      return { success: false, error: "Input length is out of allowed bounds" };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, error: "Invalid email address" };
    }

    const contact = await prisma.contactMessage.create({
      data: {
        name,
        email,
        message,
      },
    });

    revalidatePath("/admin/contacts");

    return { success: true, contact };
  } catch (error) {
    console.error("Error submitting contact message:", error);
    return {
      success: false,
      error: safeActionError(error, "Failed to submit message"),
    };
  }
}

export async function getContactMessages() {
  try {
    await requirePermission("contacts:view");
    const messages = await prisma.contactMessage.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, messages };
  } catch (error) {
    console.error("Error fetching contact messages:", error);
    return {
      success: false,
      error: safeActionError(error, "Failed to fetch messages"),
      messages: [],
    };
  }
}

export async function deleteContactMessage(id: string) {
  try {
    const user = await requirePermission("contacts:manage");
    const existing = await prisma.contactMessage.findUnique({
      where: { id },
      select: { name: true, email: true },
    });

    await prisma.contactMessage.delete({
      where: { id },
    });

    await logActivity({
      actorId: user.id,
      action: "CONTACT_DELETE",
      targetType: "ContactMessage",
      targetId: id,
      details: {
        name: existing?.name,
        email: existing?.email,
      },
    });

    revalidatePath("/admin/contacts");
    return { success: true };
  } catch (error) {
    console.error("Error deleting contact message:", error);
    return {
      success: false,
      error: safeActionError(error, "Failed to delete message"),
    };
  }
}