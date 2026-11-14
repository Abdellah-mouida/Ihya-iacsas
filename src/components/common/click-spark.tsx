"use client";

import type { CSSProperties, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLowPower } from "@/hooks/use-low-power";
import { cn } from "@/lib/utils";
import rbStyles from "./react-bits-adaptations.module.css";

const SPARK_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

export function ClickSpark({
  children,
  className,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const lowPower = useLowPower();
  const [burstId, setBurstId] = useState(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  const trigger = useCallback(() => {
    if (disabled || lowPower) return;
    setBurstId((id) => id + 1);
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(() => {
      setBurstId(0);
    }, 450);
  }, [disabled, lowPower]);

  return (
    <span
      data-rb="ClickSpark"
      onClick={trigger}
      className={cn(rbStyles.clickSpark, className)}
    >
      {children}
      {burstId > 0 && !lowPower && !disabled ? (
        <span key={burstId} aria-hidden="true" className={rbStyles.clickSparkBurst}>
          {SPARK_ANGLES.map((angle) => (
            <span
              key={angle}
              className={rbStyles.clickSparkRay}
              style={{ "--spark-angle": `${angle}deg` } as CSSProperties}
            />
          ))}
        </span>
      ) : null}
    </span>
  );
}
