"use client";

import { PageBackground } from "@/components/common/page-background";
import { IslamicLoader } from "@/components/common/islamic-loader";

export default function Loading() {
  return (
    <div
      data-testid="themed-loading-screen"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
    >
      <PageBackground
        variant="default"
        className="fixed inset-0 flex items-center justify-center pointer-events-none select-none"
      >
        <div className="relative z-20 flex flex-col items-center justify-center p-6 text-center">
          <IslamicLoader size="fullscreen" />
        </div>
      </PageBackground>
    </div>
  );
}

