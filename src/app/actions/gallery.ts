"use server";

import { revalidatePath } from "next/cache";

import { uploadImageToCloudinary } from "@/lib/cloudinary";
import { prisma } from "@/lib/prisma";

export async function getGalleryPhotos() {
  try {
    const photos = await prisma.galleryPhoto.findMany({
      orderBy: { createdAt: "desc" },
    });
    return { success: true, photos };
  } catch (error) {
    console.error("Error fetching gallery photos:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch gallery photos",
      photos: [],
    };
  }
}

export async function createGalleryPhoto(formData: FormData) {
  try {
    const file = formData.get("image") as File | null;
    let imageUrl = (formData.get("imageUrl") as string | null)?.trim() || null;
    const captionAr = (formData.get("captionAr") as string)?.trim() || null;
    const captionEn = (formData.get("captionEn") as string)?.trim() || null;

    if (!captionAr || !captionEn) {
      return {
        success: false,
        error: "Both Arabic and English captions are required.",
      };
    }

    if (file && file.size > 0) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        imageUrl = await uploadImageToCloudinary(buffer, "ihyaa-gallery");
      } catch (uploadErr) {
        if (!imageUrl) {
          const errMsg =
            uploadErr instanceof Error
              ? uploadErr.message
              : "Image upload failed";
          return { success: false, error: errMsg };
        }
      }
    }

    if (!imageUrl) {
      return { success: false, error: "Please select an image file to upload or enter an Image URL." };
    }

    const photo = await prisma.galleryPhoto.create({
      data: {
        imageUrl,
        captionAr,
        captionEn,
      },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/gallery");

    return { success: true, photo };
  } catch (error) {
    console.error("Error creating gallery photo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to save gallery photo",
    };
  }
}

export async function updateGalleryPhoto(id: string, formData: FormData) {
  try {
    const captionAr = (formData.get("captionAr") as string)?.trim() || null;
    const captionEn = (formData.get("captionEn") as string)?.trim() || null;

    if (!captionAr || !captionEn) {
      return {
        success: false,
        error: "Both Arabic and English captions are required.",
      };
    }

    const file = formData.get("image") as File | null;
    const imageUrl = (formData.get("imageUrl") as string | null)?.trim() || null;

    const dataToUpdate: {
      captionAr?: string | null;
      captionEn?: string | null;
      imageUrl?: string;
    } = {
      captionAr,
      captionEn,
    };

    if (file && file.size > 0) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        dataToUpdate.imageUrl = await uploadImageToCloudinary(buffer, "ihyaa-gallery");
      } catch (uploadErr) {
        if (imageUrl) {
          dataToUpdate.imageUrl = imageUrl;
        } else {
          return {
            success: false,
            error: uploadErr instanceof Error ? uploadErr.message : "Upload failed",
          };
        }
      }
    } else if (imageUrl) {
      dataToUpdate.imageUrl = imageUrl;
    }

    const photo = await prisma.galleryPhoto.update({
      where: { id },
      data: dataToUpdate,
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/gallery");

    return { success: true, photo };
  } catch (error) {
    console.error("Error updating gallery photo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update gallery photo",
    };
  }
}

export async function deleteGalleryPhoto(id: string) {
  try {
    await prisma.galleryPhoto.delete({
      where: { id },
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/gallery");

    return { success: true };
  } catch (error) {
    console.error("Error deleting gallery photo:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete gallery photo",
    };
  }
}
