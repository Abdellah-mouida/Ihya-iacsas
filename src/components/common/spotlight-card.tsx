"use client";

import type { PointerEvent, ReactNode } from "react";

import styles from "./spotlight-card.module.css";
import { useLowPower } from "@/hooks/use-low-power";

export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const lowPower = useLowPower({ pointerOnly: true });

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    if (lowPower || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  }

  function clearPointer(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.removeProperty("--spotlight-x");
    event.currentTarget.style.removeProperty("--spotlight-y");
  }

  return (
    <div
      onPointerMove={updatePointer}
      onPointerLeave={clearPointer}
      className={`${styles.spotlight} ${className ?? ""}`}
      data-react-bits="SpotlightCard"
    >
      <div className={styles.content}>{children}</div>
    </div>
  );
}
