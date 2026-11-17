"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { useLowPower } from "@/hooks/use-low-power";
import styles from "./in-view-reveal.module.css";

const observed = new Map<Element, IntersectionObserver>();
let sharedObserver: IntersectionObserver | null = null;

function getObserver() {
  if (sharedObserver || typeof IntersectionObserver === "undefined") return sharedObserver;

  sharedObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-reveal-state", "visible");
        sharedObserver?.unobserve(entry.target);
        observed.delete(entry.target);
      }
    },
    { rootMargin: "0px 0px -48px 0px", threshold: 0.01 },
  );

  return sharedObserver;
}

/** One shared observer applies a light transform/opacity reveal without React state updates. */
export function InViewReveal({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const lowPower = useLowPower();

  useEffect(() => {
    const element = ref.current;
    if (!element || lowPower) return;

    const observer = getObserver();
    if (!observer) return;

    const rect = element.getBoundingClientRect();
    const nearViewport = rect.top < window.innerHeight + 48 && rect.bottom > -48;
    if (nearViewport) {
      element.setAttribute("data-reveal-state", "visible");
      return;
    }

    element.setAttribute("data-reveal-state", "pending");
    observed.set(element, observer);
    observer.observe(element);

    return () => {
      observed.get(element)?.unobserve(element);
      observed.delete(element);
    };
  }, [lowPower]);

  return (
    <div ref={ref} className={`${styles.reveal} ${className ?? ""}`} data-in-view-reveal>
      {children}
    </div>
  );
}
