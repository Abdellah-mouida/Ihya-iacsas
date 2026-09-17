"use client";

import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type IslamicLoaderProps = {
  size?: "sm" | "md" | "lg" | "fullscreen";
  message?: string;
  className?: string;
};

export function IslamicLoader({
  size = "md",
  message,
  className,
}: IslamicLoaderProps) {
  const isFullscreen = size === "fullscreen";

  const sizeDimensions = {
    sm: "size-8",
    md: "size-14",
    lg: "size-20",
    fullscreen: "size-24",
  };

  const content = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 select-none",
        className,
      )}
    >
      <div className={cn("relative flex items-center justify-center", sizeDimensions[size])}>
        {/* Outer Rotating Islamic Geometric Ring */}
        <motion.svg
          viewBox="0 0 100 100"
          animate={{ rotate: 360 }}
          transition={{ duration: 16, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 size-full text-brass"
        >
          {/* 8-pointed geometric outer interlacing star */}
          <polygon
            points="50,5 63,25 85,15 75,37 95,50 75,63 85,85 63,75 50,95 37,75 15,85 25,63 5,50 25,37 15,15 37,25"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="opacity-40 dark:opacity-50"
          />
          {/* Inner 8-pointed star */}
          <polygon
            points="50,15 60,30 75,25 68,40 80,50 68,60 75,75 60,70 50,85 40,70 25,75 32,60 20,50 32,40 25,25 40,30"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-70 dark:opacity-85 text-emerald-600 dark:text-emerald-400"
          />
        </motion.svg>

        {/* Counter-rotating center medallion */}
        <motion.svg
          viewBox="0 0 50 50"
          animate={{ rotate: -360, scale: [0.95, 1.05, 0.95] }}
          transition={{
            rotate: { duration: 12, repeat: Infinity, ease: "linear" },
            scale: { duration: 2.5, repeat: Infinity, ease: "easeInOut" },
          }}
          className="size-1/2 text-brass"
        >
          <rect
            x="13"
            y="13"
            width="24"
            height="24"
            transform="rotate(45 25 25)"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-brass"
          />
          <rect
            x="13"
            y="13"
            width="24"
            height="24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-emerald-600 dark:text-emerald-400 opacity-80"
          />
          <circle
            cx="25"
            cy="25"
            r="4"
            fill="currentColor"
            className="text-brass animate-pulse"
          />
        </motion.svg>

        {/* Background glow effect */}
        <div className="absolute inset-0 -z-10 rounded-full bg-brass/10 dark:bg-brass/15 blur-xl pointer-events-none" />
      </div>

      {message ? (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xs sm:text-sm font-semibold tracking-wider text-muted-foreground"
        >
          {message}
        </motion.p>
      ) : null}
    </div>
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-md">
        {content}
      </div>
    );
  }

  return content;
}
