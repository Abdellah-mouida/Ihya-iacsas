"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";

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
    await prisma.contactMessage.delete({
      where: { id },
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