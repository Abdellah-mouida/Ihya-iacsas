import { createHmac, timingSafeEqual } from "node:crypto";

const DEFAULT_PROOF_TTL_MS = 60_000;

function getSessionSyncSecret(): string {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error("AUTH_SECRET is required for session rotation proof");
  }
  return secret;
}

function computeProofDigest(
  secret: string,
  userId: string,
  fromVersion: number,
  toVersion: number,
  expiresAtMs: number,
): string {
  return createHmac("sha256", secret)
    .update(`ihyaa-session-rotate:${userId}:${fromVersion}:${toVersion}:${expiresAtMs}`)
    .digest("hex");
}

export function signSessionRotationProof(
  userId: string,
  fromVersion: number,
  toVersion: number,
  ttlMs: number = DEFAULT_PROOF_TTL_MS,
): string {
  const expiresAtMs = Date.now() + ttlMs;
  const sig = computeProofDigest(
    getSessionSyncSecret(),
    userId,
    fromVersion,
    toVersion,
    expiresAtMs,
  );
  return `${expiresAtMs}.${sig}`;
}

export function verifySessionRotationProof(
  proof: string,
  userId: string,
  fromVersion: number,
  toVersion: number,
): boolean {
  if (!proof || !userId || toVersion <= fromVersion) return false;
  const parts = proof.split(".");
  if (parts.length !== 2) return false;

  const expiresAtMs = Number(parts[0]);
  const providedSig = parts[1];
  if (!Number.isFinite(expiresAtMs) || expiresAtMs < Date.now()) {
    return false;
  }
  if (!/^[a-f0-9]{64}$/i.test(providedSig)) {
    return false;
  }

  let expectedSig: string;
  try {
    expectedSig = computeProofDigest(
      getSessionSyncSecret(),
      userId,
      fromVersion,
      toVersion,
      expiresAtMs,
    );
  } catch {
    return false;
  }

  const providedBuf = Buffer.from(providedSig.toLowerCase(), "utf8");
  const expectedBuf = Buffer.from(expectedSig.toLowerCase(), "utf8");
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
