import https from "https";
import { v2 as cloudinary } from "cloudinary";

// IPv4 agent with keepAlive ensures fast, reliable connection in serverless & local dev
const httpsAgent = new https.Agent({ family: 4, keepAlive: true });

let isConfigured = false;

export function configureCloudinary() {
  if (isConfigured) return;

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName.trim(),
      api_key: apiKey.trim(),
      api_secret: apiSecret.trim(),
      secure: true,
    });
    isConfigured = true;
    return;
  }

  const url = process.env.CLOUDINARY_URL;
  if (url) {
    const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
    if (match) {
      const [, k, s, c] = match;
      cloudinary.config({
        cloud_name: c.trim(),
        api_key: k.trim(),
        api_secret: s.trim(),
        secure: true,
      });
      isConfigured = true;
      return;
    }
    cloudinary.config(true);
    isConfigured = true;
    return;
  }

  console.warn(
    "[Cloudinary] Configuration missing: Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET are set.",
  );
}

// Initial configuration attempt
configureCloudinary();

/**
 * Uploads a base64 string, Buffer, or File data URI to Cloudinary.
 * Returns the secure HTTPS URL.
 */
export async function uploadImageToCloudinary(
  fileData: string | Buffer,
  folder = "ihyaa-uploads",
): Promise<string> {
  const res = await uploadImageToCloudinaryDetailed(fileData, folder);
  return res.secure_url;
}

/**
 * Uploads a base64 string, Buffer, or File data URI to Cloudinary.
 * Returns both the secure HTTPS URL and the Cloudinary public_id.
 */
export async function uploadImageToCloudinaryDetailed(
  fileData: string | Buffer,
  folder = "ihyaa-uploads",
): Promise<{ secure_url: string; public_id: string }> {
  configureCloudinary();

  return new Promise((resolve, reject) => {
    let uploadPayload: string;

    if (Buffer.isBuffer(fileData)) {
      uploadPayload = `data:image/jpeg;base64,${fileData.toString("base64")}`;
    } else if (typeof fileData === "string") {
      uploadPayload = fileData;
    } else {
      return reject(new Error("Invalid file format provided for image upload"));
    }

    cloudinary.uploader.upload(
      uploadPayload,
      {
        folder,
        resource_type: "image",
        agent: httpsAgent,
      },
      (error, result) => {
        if (error || !result) {
          if (process.env.NODE_ENV !== "production") {
            console.error("[Cloudinary Server Error]", error);
          }
          const msg =
            error?.message ||
            "Cloudinary upload failed. Check API credentials or enter an Image URL directly.";
          reject(new Error(`Cloudinary Error: ${msg}`));
        } else {
          resolve({
            secure_url: result.secure_url,
            public_id: result.public_id,
          });
        }
      },
    );
  });
}

/**
 * Extracts the Cloudinary public_id from a full Cloudinary URL or raw identifier.
 * Strips transformations, version prefix, and file extensions.
 * Returns null if the string is not a Cloudinary asset (e.g. local /images/... or third-party URL).
 */
export function extractCloudinaryPublicId(urlOrId: string | null | undefined): string | null {
  if (!urlOrId || typeof urlOrId !== "string") return null;

  const trimmed = urlOrId.trim();
  if (!trimmed) return null;

  // If already a raw public_id (e.g. "ihyaa-events/abc123xyz")
  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://") && !trimmed.startsWith("/")) {
    return trimmed.replace(/\.[a-zA-Z0-9]+$/, "");
  }

  // If local path or non-Cloudinary host, ignore
  if (!trimmed.includes("res.cloudinary.com") && !trimmed.includes("cloudinary.com")) {
    return null;
  }

  try {
    const urlObj = new URL(trimmed);
    const pathname = urlObj.pathname;
    const uploadIndex = pathname.indexOf("/upload/");
    if (uploadIndex === -1) return null;

    const afterUpload = pathname.substring(uploadIndex + "/upload/".length);
    const segments = afterUpload.split("/");
    const nonParamSegments: string[] = [];
    let passedVersion = false;

    for (const seg of segments) {
      if (!seg) continue;
      // Version segment e.g. "v1747800000"
      if (/^v\d+$/.test(seg)) {
        passedVersion = true;
        continue;
      }
      // Transformation parameters (e.g. "c_fill,w_500", "q_auto,f_auto") before version
      if (!passedVersion && (seg.includes(",") || /^[a-z]_[a-z0-9_-]+/i.test(seg))) {
        continue;
      }
      nonParamSegments.push(seg);
    }

    if (nonParamSegments.length === 0) return null;
    const fullPath = nonParamSegments.join("/");
    return fullPath.replace(/\.[a-zA-Z0-9]+$/, "") || null;
  } catch {
    return null;
  }
}

/**
 * Deletes an image from Cloudinary given its public_id or full URL.
 * Fails gracefully: logs error and returns { success: false, error } without throwing,
 * so caller can proceed with database cleanup.
 */
export async function deleteImageFromCloudinary(
  urlOrPublicId: string | null | undefined,
): Promise<{ success: boolean; result?: string; error?: string }> {
  const publicId = extractCloudinaryPublicId(urlOrPublicId);
  if (!publicId) {
    return { success: true, result: "skipped_non_cloudinary" };
  }

  configureCloudinary();

  try {
    return await new Promise((resolve) => {
      cloudinary.uploader.destroy(
        publicId,
        {
          resource_type: "image",
          invalidate: true,
        },
        (error, result) => {
          if (error) {
            console.warn(`[Cloudinary Warning] Failed to delete asset ${publicId}:`, error.message);
            resolve({ success: false, error: error.message || "Failed to delete from Cloudinary" });
          } else {
            resolve({ success: true, result: result?.result });
          }
        },
      );
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Cloudinary delete failed";
    console.warn(`[Cloudinary Warning] Exception deleting asset ${publicId}:`, errorMsg);
    return { success: false, error: errorMsg };
  }
}

export { cloudinary };
