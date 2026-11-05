import type { Transition } from "framer-motion";

export const DURATION = {
  fast: 0.15,
  base: 0.2,
  slow: 0.25,
} as const;

export const EASE_STANDARD: [number, number, number, number] = [0.2, 0, 0, 1];

export const FAST_TRANSITION: Transition = { duration: DURATION.fast, ease: EASE_STANDARD };

export const BASE_TRANSITION: Transition = { duration: DURATION.base, ease: EASE_STANDARD };

export const SLOW_TRANSITION: Transition = { duration: DURATION.slow, ease: EASE_STANDARD };
