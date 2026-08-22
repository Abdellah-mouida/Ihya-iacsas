import type { Variants, Transition } from "framer-motion";

// Signature premium easing (expo-out style)
export const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const softSpring: Transition = {
  type: "spring",
  stiffness: 120,
  damping: 18,
  mass: 0.8,
};

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const fadeDown: Variants = {
  hidden: { opacity: 0, y: -24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: EASE } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.9, ease: EASE } },
};

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.7, ease: EASE } },
};

export const blurUp: Variants = {
  hidden: { opacity: 0, y: 30, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.8, ease: EASE },
  },
};

// Directional reveal that respects RTL/LTR: pass +1 (from inline-end) or -1
export const slideIn = (dir: number = 1): Variants => ({
  hidden: { opacity: 0, x: 48 * dir },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE } },
});

export const staggerContainer = (
  stagger: number = 0.12,
  delayChildren: number = 0.05,
): Variants => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

// Shared viewport config for scroll-triggered reveals
export const viewportOnce = { once: true, amount: 0.2 } as const;
