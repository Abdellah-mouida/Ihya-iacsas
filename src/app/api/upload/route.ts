import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { uploadImageToCloudinaryDetailed } from "@/lib/cloudinary";
import { readImageDimensions } from "@/lib/image-dimensions";

const FOLDERS = new Set(["avatars", "covers"]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/jpg"]);

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder");
    if (!(file instanceof File) || file.size === 0 || !ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Choose a JPG, PNG, or WebP image." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "Image file size exceeds the 8MB limit." }, { status: 413 });
    if (typeof folder !== "string" || !FOLDERS.has(folder)) return NextResponse.json({ error: "Unsupported upload folder." }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const [upload, dimensions] = await Promise.all([
      uploadImageToCloudinaryDetailed(buffer, folder === "avatars" ? "ihyaa-profiles" : "ihyaa-covers"),
      readImageDimensions(buffer),
    ]);
    return NextResponse.json({ url: upload.secure_url, publicId: upload.public_id, ...dimensions });
  } catch (error) {
    console.error("[upload] Image upload failed:", error);
    return NextResponse.json({ error: "Image upload failed." }, { status: 500 });
  }
}
