"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type InViewMountProps = {
  children: ReactNode;
  placeholder?: ReactNode;
  className?: string;
  /** Keeps layout space while effects below the fold are not mounted. */
  minHeight?: CSSProperties["minHeight"];
  rootMargin?: string;
  once?: boolean;
};

/** Mounts optional, expensive effects only while their reserved region is visible. */
export function InViewMount({
  children,
  placeholder = null,
  className,
  minHeight,
  rootMargin = "160px 0px",
  once = false,
}: InViewMountProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [intersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          if (!once) setIntersecting(false);
          return;
        }
        setIntersecting(true);
        if (once) observer.disconnect();
      },
      { rootMargin },
    );
    observer.observe(host);

    return () => observer.disconnect();
  }, [once, rootMargin]);

  useEffect(() => {
    const update = () => setActive((prev) => (once && prev) || (intersecting && document.visibilityState === "visible"));
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [intersecting, once]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={minHeight === undefined ? undefined : { minHeight }}
      data-in-view-mount
    >
      {active ? children : placeholder}
    </div>
  );
}
