"use client";

import { motion } from "framer-motion";
import { ArrowRight, Compass, Home } from "lucide-react";
import Link from "next/link";

import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center p-6 text-foreground overflow-hidden">
      {/* Background ambient lighting and pattern */}
      <div className="pattern-islamic absolute inset-0 -z-10 opacity-60" />
      <div className="bg-brass-gradient absolute top-1/3 start-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-strong relative z-10 mx-auto max-w-lg w-full rounded-[2rem] border border-brass/30 p-8 sm:p-10 text-center shadow-layered backdrop-blur-xl"
      >
        {/* Animated Islamic 8-pointed motif */}
        <div className="relative mx-auto mb-6 flex size-24 items-center justify-center">
          <motion.svg
            viewBox="0 0 100 100"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 size-full text-brass/40"
          >
            <polygon
              points="50,5 63,25 85,15 75,37 95,50 75,63 85,85 63,75 50,95 37,75 15,85 25,63 5,50 25,37 15,15 37,25"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            />
          </motion.svg>
          <motion.div
            animate={{ scale: [0.95, 1.05, 0.95] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="font-heading text-3xl font-extrabold text-brass"
          >
            404
          </motion.div>
        </div>

        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          الصفحة غير موجودة
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-brass">
          Page Not Found
        </p>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          يبدو أن الرابط الذي تبحث عنه غير متاح أو تم نقله. يمكنك العودة واستكشاف فعاليات وأنشطة الجمعية.
        </p>

        <div className="my-6">
          <OrnamentDivider compact />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            className="bg-brass-gradient h-11 w-full sm:w-auto rounded-full px-6 font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            <Link href="/">
              <Home className="size-4 me-2 shrink-0" />
              العودة للرئيسية
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="glass h-11 w-full sm:w-auto rounded-full px-6 font-semibold"
          >
            <Link href="/events">
              <Compass className="size-4 me-2 shrink-0 text-brass" />
              الفعاليات
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
