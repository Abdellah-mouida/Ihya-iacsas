"use client";

import { motion } from "framer-motion";
import {
  type ClipboardEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { cn } from "@/lib/utils";

type SegmentedOtpInputProps = {
  value: string;
  onChange: (otp: string) => void;
  onComplete?: (otp: string) => void;
  hasError?: boolean;
  isSuccess?: boolean;
  disabled?: boolean;
};

export function SegmentedOtpInput({
  value,
  onChange,
  onComplete,
  hasError = false,
  isSuccess = false,
  disabled = false,
}: SegmentedOtpInputProps) {
  const digits = 6;
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Split string value into array of 6 characters
  const chars = Array.from({ length: digits }, (_, i) => value[i] || "");

  // Auto focus first empty input on mount
  useEffect(() => {
    const firstEmpty = chars.findIndex((c) => !c);
    const targetIdx = firstEmpty === -1 ? 0 : firstEmpty;
    inputRefs.current[targetIdx]?.focus();
  }, []);

  const handleChange = (index: number, val: string) => {
    const cleanDigit = val.replace(/\D/g, "").slice(-1);

    const newChars = [...chars];
    newChars[index] = cleanDigit;
    const newOtp = newChars.join("");
    onChange(newOtp);

    // If digit was entered, advance to next box
    if (cleanDigit && index < digits - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Trigger onComplete if full 6 digits filled
    if (newOtp.length === digits && !newOtp.includes(" ")) {
      onComplete?.(newOtp);
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!chars[index] && index > 0) {
        // Move back and clear previous
        const newChars = [...chars];
        newChars[index - 1] = "";
        onChange(newChars.join(""));
        inputRefs.current[index - 1]?.focus();
      } else {
        const newChars = [...chars];
        newChars[index] = "";
        onChange(newChars.join(""));
      }
    } else if (e.key === "ArrowLeft") {
      if (index > 0) inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight") {
      if (index < digits - 1) inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, digits);
    if (!pasted) return;

    onChange(pasted);
    const nextIdx = Math.min(pasted.length, digits - 1);
    inputRefs.current[nextIdx]?.focus();

    if (pasted.length === digits) {
      onComplete?.(pasted);
    }
  };

  return (
    <motion.div
      animate={
        hasError
          ? { x: [-6, 6, -4, 4, -2, 2, 0] }
          : isSuccess
          ? { scale: [1, 1.03, 1] }
          : {}
      }
      transition={{ duration: 0.4 }}
      className="flex items-center justify-center gap-2 sm:gap-3 dir-ltr"
      dir="ltr"
    >
      {Array.from({ length: digits }).map((_, index) => {
        const char = chars[index];
        const isFocused = focusedIndex === index;

        return (
          <motion.div
            key={index}
            animate={{
              scale: isFocused ? 1.05 : 1,
              borderColor: hasError
                ? "var(--destructive)"
                : isSuccess
                ? "#10b981"
                : isFocused
                ? "var(--brass)"
                : char
                ? "rgba(212, 175, 55, 0.4)"
                : "rgba(255, 255, 255, 0.12)",
            }}
            transition={{ duration: 0.15 }}
            className={cn(
              "relative flex size-12 sm:size-14 items-center justify-center rounded-2xl border bg-background/50 backdrop-blur-md transition-shadow",
              isFocused &&
                "shadow-[0_0_15px_rgba(212,175,55,0.25)] ring-2 ring-brass/40",
              hasError &&
                "border-destructive shadow-[0_0_15px_rgba(239,68,68,0.25)] ring-1 ring-destructive",
              isSuccess &&
                "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.25)] ring-1 ring-emerald-500",
            )}
          >
            <input
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              id={index === 0 ? "b-otp" : `b-otp-${index}`}
              data-testid={`otp-box-${index}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={char}
              disabled={disabled}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              className="size-full bg-transparent text-center font-heading text-xl sm:text-2xl font-bold text-foreground outline-none selection:bg-transparent"
              autoComplete="one-time-code"
            />

            {/* Subtle bottom indicator line */}
            <div
              className={cn(
                "absolute bottom-2 h-0.5 w-4 rounded-full transition-colors",
                isFocused
                  ? "bg-brass"
                  : char
                  ? "bg-brass/60"
                  : "bg-muted-foreground/30",
              )}
            />
          </motion.div>
        );
      })}
    </motion.div>
  );
}