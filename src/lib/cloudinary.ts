import { v2 as cloudinary } from "cloudinary";

function configureCloudinary() {
  const url = process.env.CLOUDINARY_URL;
  if (!url) {
    console.warn("CLOUDINARY_URL environment variable is missing.");
    return;
  }

  // Parse cloudinary://<api_key>:<api_secret>@<cloud_name>
  const match = url.match(/^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
  if (match) {
    const [, apiKey, apiSecret, cloudName] = match;
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
  } else {
    cloudinary.config(true);
  }
}

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
    // Convert Buffer to data URI for direct upload API
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
      },
      (error, result) => {
        if (error || !result) {
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
