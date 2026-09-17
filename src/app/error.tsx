"use client";

import { motion } from "framer-motion";
import { AlertCircle, Home, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { OrnamentDivider } from "@/components/common/ornament-divider";
import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error boundary caught:", error);
  }, [error]);

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center p-6 text-foreground overflow-hidden">
      {/* Background ambient lighting and pattern */}
      <div className="pattern-islamic absolute inset-0 -z-10 opacity-60" />
      <div className="bg-destructive absolute top-1/3 start-1/2 -z-10 size-96 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-10 blur-3xl" />

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="glass-strong relative z-10 mx-auto max-w-lg w-full rounded-[2rem] border border-destructive/30 p-8 sm:p-10 text-center shadow-layered backdrop-blur-xl"
      >
        {/* Animated Islamic ornament with error badge */}
        <div className="relative mx-auto mb-6 flex size-20 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-destructive/15 blur-lg" />
          <div className="grid size-16 place-items-center rounded-2xl border border-destructive/40 bg-destructive/10 text-destructive shadow-sm">
            <AlertCircle className="size-8" />
          </div>
        </div>

        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-foreground">
          حدث خطأ غير متوقع
        </h1>
        <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-destructive">
          Something went wrong
        </p>

        <p className="mt-3 text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          نعتذر عن هذا الخطأ المؤقت. يمكنك محاولة إعادة تحميل الصفحة أو العودة للصفحة الرئيسية.
        </p>

        <div className="my-6">
          <OrnamentDivider compact />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            onClick={() => reset()}
            className="bg-brass-gradient h-11 w-full sm:w-auto rounded-full px-6 font-semibold text-night shadow-layered transition-all hover:-translate-y-0.5 hover:opacity-95"
          >
            <RotateCcw className="size-4 me-2 shrink-0" />
            إعادة المحاولة
          </Button>

          <Button
            asChild
            variant="outline"
            className="glass h-11 w-full sm:w-auto rounded-full px-6 font-semibold"
          >
            <Link href="/">
              <Home className="size-4 me-2 shrink-0 text-brass" />
              الصفحة الرئيسية
            </Link>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
