import type { NextConfig } from "next";

// Extra origins allowed to reach the Next.js dev server (e.g. your machine's
// LAN IP so you can open the site from a phone). Set ALLOWED_DEV_ORIGINS to a
// comma-separated list to override; defaults to localhost so it works out of
// the box on any machine/network. See .env.example.
const allowedDevOrigins = (
  process.env.ALLOWED_DEV_ORIGINS ?? "localhost,127.0.0.1"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  allowedDevOrigins,
};

export default nextConfig;
