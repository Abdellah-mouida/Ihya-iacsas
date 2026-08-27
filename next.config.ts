import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Allow opening the dev server from other devices on the LAN (e.g. a phone)
  // without Next.js blocking its dev/HMR resources as cross-origin.
  allowedDevOrigins: ["192.168.100.27"],
};

export default nextConfig;
