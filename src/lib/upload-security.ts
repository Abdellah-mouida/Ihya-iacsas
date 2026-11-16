import { createHmac, timingSafeEqual } from "node:crypto";

export type UploadFolder = "avatars" | "covers";

export interface VerifiedUploadPayload {
  userId: string;
  folder: UploadFolder;
  url: string;
  publicId: string;
  imageWidth: number | null;
  imageHeight: number | null;
  exp: number;
}

const PROOF_TTL_MS = 10 * 60 * 1000;

function getUploadSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("AUTH_SECRET is required for upload proof");
  }
  return secret;
}

export function hasValidImageMagicBytes(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return true;
  }
  // WebP: RIFF....WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return true;
  }
  return false;
}

export function isSafeLocalAssetPath(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.includes("..")) return false;
  return /^\/(?:patterns|images)\/[a-zA-Z0-9._/-]+$/.test(trimmed);
}

export function isSafePublicImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) {
    return !trimmed.startsWith("//") && !trimmed.startsWith("/\\") && !trimmed.includes("..");
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function expectedCloudinaryPrefixForFolder(folder: UploadFolder): string {
  return folder === "avatars" ? "ihyaa-profiles/" : "ihyaa-covers/";
}

export function signUploadProof(input: {
  userId: string;
  folder: UploadFolder;
  url: string;
  publicId: string;
  imageWidth: number | null;
  imageHeight: number | null;
}): string {
  const payload: VerifiedUploadPayload = {
    ...input,
    exp: Date.now() + PROOF_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getUploadSecret())
    .update(`ihyaa-upload:${encoded}`)
    .digest("hex");
  return `${encoded}.${sig}`;
}

export function verifyUploadProof(
  proof: string,
  expectedUserId: string,
  expectedFolder: UploadFolder,
): VerifiedUploadPayload | null {
  if (!proof || typeof proof !== "string") return null;
  const parts = proof.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !/^[a-f0-9]{64}$/i.test(providedSig)) return null;

  let expectedSig: string;
  try {
    expectedSig = createHmac("sha256", getUploadSecret())
      .update(`ihyaa-upload:${encoded}`)
      .digest("hex");
  } catch {
    return null;
  }

  const providedBuf = Buffer.from(providedSig.toLowerCase(), "utf8");
  const expectedBuf = Buffer.from(expectedSig.toLowerCase(), "utf8");
  if (providedBuf.length !== expectedBuf.length || !timingSafeEqual(providedBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as Partial<VerifiedUploadPayload>;
    if (
      typeof parsed.exp !== "number" ||
      !Number.isFinite(parsed.exp) ||
      parsed.exp < Date.now() ||
      parsed.userId !== expectedUserId ||
      parsed.folder !== expectedFolder ||
      typeof parsed.url !== "string" ||
      !parsed.url.startsWith("https://") ||
      typeof parsed.publicId !== "string" ||
      !parsed.publicId.startsWith(expectedCloudinaryPrefixForFolder(expectedFolder))
    ) {
      return null;
    }
    return {
      userId: parsed.userId,
      folder: parsed.folder,
      url: parsed.url,
      publicId: parsed.publicId,
      imageWidth: typeof parsed.imageWidth === "number" ? parsed.imageWidth : null,
      imageHeight: typeof parsed.imageHeight === "number" ? parsed.imageHeight : null,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
