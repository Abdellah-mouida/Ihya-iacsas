"use client";

import { motion } from "framer-motion";
import { OrnamentDivider } from "@/components/common/ornament-divider";

const GlassmorphismCard = ({ children }: { children: React.ReactNode }) => (
  <div className="relative p-8 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl shadow-lg">
    <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent rounded-2xl pointer-events-none" />
    {children}
  </div>
);

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-foreground">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-8"
      >
        <h1 className="text-6xl font-bold text-red-500 mb-4">خطأ</h1>
        <h2 className="text-2xl font-semibold mb-6">حدث خطأ غير متوقع</h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          نعتذر، حدثت مشكلة أثناء تحميل هذه الصفحة. يمكنك محاولة إعادة التحميل.
        </p>
      </motion.div>

      <OrnamentDivider className="my-8" />

      <GlassmorphismCard>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="text-center"
        >
          <svg
            width="120"
            height="120"
            viewBox="0 0 24 24"
            fill="none"
            className="mx-auto mb-6 text-brass"
          >
            {/* Islamic geometric motif */}
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
              fill="currentColor"
              opacity="0.9"
            />
            {/* Star */}
            <g
              className="text-green"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity="0.9"
              transform="translate(2 2)"
            >
              <rect x="4.2" y="4.2" width="6" height="6" transform="rotate(45 7.2 7.2)" />
            </g>
          </svg>
          <p className="text-muted-foreground mb-6">
            إذا استمرت المشكلة، يمكنك العودة إلى الصفحة الرئيسية أو التواصل معنا.
          </p>
          <div className="flex gap-4 justify-center">
            <motion.button
              onClick={reset}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-brass text-white rounded-full font-medium hover:bg-brass/90 transition-colors"
            >
              إعادة المحاولة
            </motion.button>
            <motion.a
              href="/"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-full font-medium hover:bg-secondary/80 transition-colors"
            >
              العودة إلى الصفحة الرئيسية
            </motion.a>
          </div>
        </motion.div>
      </GlassmorphismCard>
    </div>
  );
}