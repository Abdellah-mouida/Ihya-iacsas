"use client";

import { motion } from "framer-motion";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        className="relative flex items-center justify-center w-24 h-24"
      >
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full text-brass animate-spin-slow"
        >
          {/* Islamic Geometric 8-point star background motif */}
          <polygon
            points="50,5 63,25 85,15 75,37 95,50 75,63 85,85 63,75 50,95 37,75 15,85 25,63 5,50 25,37 15,15 37,25"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="opacity-40"
          />
          <polygon
            points="50,15 60,30 75,25 68,40 80,50 68,60 75,75 60,70 50,85 40,70 25,75 32,60 20,50 32,40 25,25 40,30"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="opacity-80"
          />
          <circle
            cx="50"
            cy="50"
            r="12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-emerald-600 dark:text-emerald-400"
          />
        </svg>
      </motion.div>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-4 text-sm font-medium tracking-widest text-muted-foreground uppercase"
      >
        جاري التحميل...
      </motion.p>
    </div>
  );
}