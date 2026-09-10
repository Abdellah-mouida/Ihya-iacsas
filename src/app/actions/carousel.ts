"use server";

import { revalidatePath } from "next/cache";

import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export async function getCarouselPosts(onlyActive = false) {
  try {
    const posts = await prisma.carouselPost.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: { order: "asc" },
    });
    return { success: true, posts };
  } catch (error) {
    console.error("Error fetching carousel posts:", error);
    return { success: false, error: "Failed to fetch carousel posts", posts: [] };
  }
}

export async function createCarouselPost(formData: FormData) {
  try {
    const file = formData.get("image") as File | null;
    const orderStr = formData.get("order") as string;
    const activeStr = formData.get("active") as string;

    let imageUrl = formData.get("imageUrl") as string | null;

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      imageUrl = await uploadImageToCloudinary(buffer, "ihyaa-carousel");
    }

    if (!imageUrl) {
      return { success: false, error: "Image file or URL is required" };
    }

    const order = orderStr ? parseInt(orderStr, 10) : 0;
    const active = activeStr === "true" || activeStr === "on";

    const post = await prisma.carouselPost.create({
      data: {
        imageUrl,
        order,
        active,
      },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/carousel");

    return { success: true, post };
  } catch (error) {
    console.error("Error creating carousel post:", error);
    return { success: false, error: "Failed to create carousel post" };
  }
}

export async function updateCarouselPost(id: string, formData: FormData) {
  try {
    const file = formData.get("image") as File | null;
    const orderStr = formData.get("order") as string;
    const activeStr = formData.get("active") as string;

    const dataToUpdate: {
      order?: number;
      active?: boolean;
      imageUrl?: string;
    } = {};

    if (orderStr !== null && orderStr !== undefined) {
      dataToUpdate.order = parseInt(orderStr, 10);
    }

    if (activeStr !== null && activeStr !== undefined) {
      dataToUpdate.active = activeStr === "true" || activeStr === "on";
    }

    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      dataToUpdate.imageUrl = await uploadImageToCloudinary(buffer, "ihyaa-carousel");
    }

    const post = await prisma.carouselPost.update({
      where: { id },
      data: dataToUpdate,
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/carousel");

    return { success: true, post };
  } catch (error) {
    console.error("Error updating carousel post:", error);
    return { success: false, error: "Failed to update carousel post" };
  }
}

export async function toggleCarouselActive(id: string, active: boolean) {
  try {
    const post = await prisma.carouselPost.update({
      where: { id },
      data: { active },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/carousel");

    return { success: true, post };
  } catch (error) {
    console.error("Error toggling carousel post:", error);
    return { success: false, error: "Failed to toggle carousel post active status" };
  }
}

export async function deleteCarouselPost(id: string) {
  try {
    await prisma.carouselPost.delete({
      where: { id },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/carousel");

    return { success: true };
  } catch (error) {
    console.error("Error deleting carousel post:", error);
    return { success: false, error: "Failed to delete carousel post" };
  }
}
