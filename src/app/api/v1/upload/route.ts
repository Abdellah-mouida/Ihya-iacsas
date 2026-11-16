import { handleCorsPreflight, withV1 } from "@/lib/api/v1/cors";
import { ApiError, jsonOk } from "@/lib/api/v1/errors";
import { requireApiActor } from "@/lib/api/v1/guard";
import { uploadImageToCloudinaryDetailed } from "@/lib/cloudinary";
import { readImageDimensions } from "@/lib/image-dimensions";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  hasValidImageMagicBytes,
  signUploadProof,
  type UploadFolder,
} from "@/lib/upload-security";

const FOLDERS = new Set<UploadFolder>(["avatars", "covers"]);
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

export function OPTIONS(request: Request) {
  return handleCorsPreflight(request);
}

export async function POST(request: Request) {
  return withV1(request, async () => {
    const actor = await requireApiActor(request);

    const rl = await checkRateLimit(`upload:${actor.id}`, 20, 3600);
    if (!rl.allowed) {
      throw new ApiError(
        429,
        "RATE_LIMITED",
        "Too many uploads. Please try again later.",
        { headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const folder = formData.get("folder");

    if (!(file instanceof File) || file.size === 0 || !ALLOWED_TYPES.has(file.type)) {
      throw new ApiError(
        400,
        "INVALID_IMAGE",
        "Choose a JPG, PNG, or WebP image.",
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Image file size exceeds the 8MB limit.",
      );
    }
    if (typeof folder !== "string" || !FOLDERS.has(folder as UploadFolder)) {
      throw new ApiError(400, "INVALID_FOLDER", "Unsupported upload folder.");
    }

    const typedFolder = folder as UploadFolder;
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!hasValidImageMagicBytes(buffer)) {
      throw new ApiError(400, "INVALID_IMAGE", "Invalid image file content.");
    }

    const [upload, dimensions] = await Promise.all([
      uploadImageToCloudinaryDetailed(
        buffer,
        typedFolder === "avatars" ? "ihyaa-profiles" : "ihyaa-covers",
      ),
      readImageDimensions(buffer),
    ]);

    const uploadProof = signUploadProof({
      userId: actor.id,
      folder: typedFolder,
      url: upload.secure_url,
      publicId: upload.public_id,
      imageWidth: dimensions.imageWidth ?? null,
      imageHeight: dimensions.imageHeight ?? null,
    });

    return jsonOk({
      url: upload.secure_url,
      publicId: upload.public_id,
      ...dimensions,
      uploadProof,
    });
  });
}
