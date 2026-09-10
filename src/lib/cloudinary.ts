import { v2 as cloudinary } from "cloudinary";

// Cloudinary auto-configures from process.env.CLOUDINARY_URL
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    secure: true,
  });
}

/**
 * Uploads a base64 or Buffer image to Cloudinary in the 'ihyaa-uploads' folder
 * and returns the secure HTTPS URL.
 */
export async function uploadImageToCloudinary(
  fileData: string | Buffer,
  folder = "ihyaa-uploads",
): Promise<string> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Failed to upload image to Cloudinary"));
        } else {
          resolve(result.secure_url);
        }
      },
    );

    if (Buffer.isBuffer(fileData)) {
      uploadStream.end(fileData);
    } else if (typeof fileData === "string") {
      // If it's a base64 data URI or string
      cloudinary.uploader
        .upload(fileData, { folder, resource_type: "image" })
        .then((res) => resolve(res.secure_url))
        .catch(reject);
    } else {
      reject(new Error("Invalid file data passed to upload"));
    }
  });
}

export { cloudinary };
