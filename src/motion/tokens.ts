/**
 * Calm, bank-grade motion tokens for Lumenfield Credit Union.
 * Prefer transform + opacity; keep hero choreography ≤ ~800ms total.
 */
export const MOTION = {
  duration: {
    instant: 0.12,
    fast: 0.15,
    base: 0.25,
    slow: 0.4,
    hero: 0.45,
  },
  ease: {
    out: [0.22, 1, 0.36, 1] as const,
    standard: [0.4, 0, 0.2, 1] as const,
  },
  distance: {
    xs: 8,
    sm: 16,
    md: 24,
  },
  stagger: {
    tight: 0.04,
    base: 0.055,
    loose: 0.07,
  },
  /** Cap list stagger children for performance */
  maxStaggerChildren: 8,
} as const;

export type MotionDuration = keyof typeof MOTION.duration;
