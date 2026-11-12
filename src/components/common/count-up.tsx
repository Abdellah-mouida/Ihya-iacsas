"use client";

import { useEffect, useRef } from "react";

export function CountUp({ value, locale, className }: { value: number; locale: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = new Intl.NumberFormat(locale);

  useEffect(() => {
    const element = ref.current;
    if (!element || value <= 0 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let frame = 0;
    let startedAt = 0;
    const numberFormat = new Intl.NumberFormat(locale);
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const tick = (time: number) => {
        if (!startedAt) startedAt = time;
        const progress = Math.min((time - startedAt) / 700, 1);
        const eased = 1 - (1 - progress) ** 3;
        element.textContent = numberFormat.format(Math.round(value * eased));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    observer.observe(element);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [locale, value]);

  return <span ref={ref} data-rb="CountUp" className={className}>{format.format(value)}</span>;
}
