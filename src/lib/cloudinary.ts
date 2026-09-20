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
          resolve(result.secure_url);
        }
      },
    );
  });
}

export { cloudinary };
