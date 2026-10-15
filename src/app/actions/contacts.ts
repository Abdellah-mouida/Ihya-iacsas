"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function submitContactMessage(data: {
  name: string;
  email: string;
  message: string;
}) {
  try {
    const { name, email, message } = data;

    if (!name || !email || !message) {
      return { success: false, error: "Please fill in all fields" };
    }

    const contact = await prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        message: message.trim(),
      },
    });

    revalidatePath("/admin/contacts");

    return { success: true, contact };
  } catch (error) {
    console.error("Error submitting contact message:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit message",
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
      error: error instanceof Error ? error.message : "Failed to fetch messages",
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

    await createAuditLog({
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
      error: error instanceof Error ? error.message : "Failed to delete message",
    };
  }
}