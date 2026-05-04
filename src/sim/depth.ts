import { PIPETTE } from './config';

export interface LowerState {
  depth: number;
  isPuncture: boolean;
}

/**
 * Map a Space-key hold duration (ms) to a lowering depth (0..1) and a
 * puncture flag. Pure — used both at runtime and in tests.
 *
 *   0                          → { 0, false }
 *   LOWER_HOLD_FULL_MS         → { 1, false }   (correct depth, just reached)
 *   LOWER_HOLD_PUNCTURE_MS     → { 1, true  }   (held too long)
 *   between FULL and PUNCTURE  → { 1, false }   (already at floor, not yet punctured)
 *   negative input             → { 0, false }   (defensive)
 */
export function depthFromHoldMs(holdMs: number): LowerState {
  if (holdMs <= 0) return { depth: 0, isPuncture: false };
  if (holdMs < PIPETTE.LOWER_HOLD_FULL_MS) {
    return { depth: holdMs / PIPETTE.LOWER_HOLD_FULL_MS, isPuncture: false };
  }
  return {
    depth: 1,
    isPuncture: holdMs >= PIPETTE.LOWER_HOLD_PUNCTURE_MS,
  };
}

/**
 * Linear interpolation: hover Y when depth=0, target Y when depth=1.
 */
export function loweredY(hoverY: number, targetY: number, depth: number): number {
  const clamped = Math.max(0, Math.min(1, depth));
  return hoverY + (targetY - hoverY) * clamped;
}
