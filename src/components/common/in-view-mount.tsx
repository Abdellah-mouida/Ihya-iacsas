"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type InViewMountProps = {
  children: ReactNode;
  placeholder?: ReactNode;
  className?: string;
  /** Keeps layout space while effects below the fold are not mounted. */
  minHeight?: CSSProperties["minHeight"];
  rootMargin?: string;
};

/** Mounts optional, expensive effects only while their reserved region is visible. */
export function InViewMount({
  children,
  placeholder = null,
  className,
  minHeight,
  rootMargin = "160px 0px",
}: InViewMountProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [intersecting, setIntersecting] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIntersecting(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(host);

    return () => observer.disconnect();
  }, [rootMargin]);

  useEffect(() => {
    const update = () => setActive(intersecting && document.visibilityState === "visible");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, [intersecting]);

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
