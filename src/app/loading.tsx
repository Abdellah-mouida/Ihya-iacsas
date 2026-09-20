"use client";

import { IslamicLoader } from "@/components/common/islamic-loader";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
      <IslamicLoader size="fullscreen" message="جاري التحميل..." />
    </div>
  );
}
