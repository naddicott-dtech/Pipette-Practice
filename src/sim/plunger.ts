import { PLUNGER } from './config';

/**
 * The plunger's runtime state during a single press-and-release cycle.
 * Created when the player begins holding (`startCurve`), advanced each
 * frame (`tickCurve`), evaluated on release (`plungerOutcome`).
 */
export interface PlungerCurve {
  /** Wall-clock ms when the press began; null when at rest. */
  startMs: number | null;
  /** ms since startMs (0 when at rest). */
  currentMs: number;
  /** Maximum depth (0..1) reached over the press. Monotone non-decreasing. */
  peakDepth: number;
}

export type PlungerOutcome = 'aborted' | 'short' | 'soft' | 'overshoot' | 'hard';

/**
 * Player-intent verbs the plunger can perform. Pickup and discard are
 * tap-driven (not plunger-driven) since the 2026-05-06 follow-up — only
 * draw and eject still use the plunger curve.
 */
export type PlungerAction = 'draw' | 'eject';

/** End of the soft-stop pause window — the curve resumes climbing here. */
const SOFT_PAUSE_END_MS =
  PLUNGER.HOLD_TO_SOFT_MS + PLUNGER.SOFT_STOP_RESISTANCE_MS;

/**
 * Outcome boundary for "soft" — peakDepth at or above this counts as a
 * soft press. Set to one tolerance below the soft stop so a press that
 * grazes the soft-stop pause without quite hitting 0.7 still registers.
 */
const SOFT_OUTCOME_THRESHOLD =
  PLUNGER.SOFT_STOP - PLUNGER.SOFT_STOP_TOLERANCE;

export function emptyCurve(): PlungerCurve {
  return { startMs: null, currentMs: 0, peakDepth: 0 };
}

export function startCurve(nowMs: number): PlungerCurve {
  return { startMs: nowMs, currentMs: 0, peakDepth: 0 };
}

/**
 * Advance the curve to the given wall-clock time. peakDepth is monotone
 * non-decreasing across calls. Returns a new curve; doesn't mutate.
 */
export function tickCurve(curve: PlungerCurve, nowMs: number): PlungerCurve {
  if (curve.startMs === null) return curve;
  const currentMs = Math.max(0, nowMs - curve.startMs);
  const depth = plungerDepthFromHoldMs(currentMs);
  return {
    startMs: curve.startMs,
    currentMs,
    peakDepth: Math.max(curve.peakDepth, depth),
  };
}

/**
 * Hold-duration to plunger depth. The piecewise linear curve has a
 * deliberate pause at the soft stop so the player can *feel* it (audio
 * click + visual notch hooked off this pause by the driver).
 *
 *   0..HOLD_TO_SOFT_MS         linear 0 → SOFT_STOP
 *   HOLD_TO_SOFT_MS..+RESIST   hold at SOFT_STOP (the felt click)
 *   +RESIST..HOLD_TO_HARD_MS   linear SOFT_STOP → HARD_STOP
 *   beyond                     clamped at HARD_STOP
 */
export function plungerDepthFromHoldMs(holdMs: number): number {
  if (holdMs <= 0) return PLUNGER.REST;
  if (holdMs < PLUNGER.HOLD_TO_SOFT_MS) {
    return (holdMs / PLUNGER.HOLD_TO_SOFT_MS) * PLUNGER.SOFT_STOP;
  }
  if (holdMs < SOFT_PAUSE_END_MS) {
    return PLUNGER.SOFT_STOP;
  }
  if (holdMs < PLUNGER.HOLD_TO_HARD_MS) {
    const span = PLUNGER.HOLD_TO_HARD_MS - SOFT_PAUSE_END_MS;
    const t = (holdMs - SOFT_PAUSE_END_MS) / span;
    return PLUNGER.SOFT_STOP + t * (PLUNGER.HARD_STOP - PLUNGER.SOFT_STOP);
  }
  return PLUNGER.HARD_STOP;
}

/**
 * Upper bound of the soft-stop tolerance band. peakDepth at or above
 * this counts as "past the click" — for DRAW that's an overshoot
 * (drawing extra volume); for LOAD it's still partial delivery.
 */
const OVERSHOOT_OUTCOME_THRESHOLD =
  PLUNGER.SOFT_STOP + PLUNGER.SOFT_STOP_TOLERANCE;

/**
 * Classify a completed press by peak depth. Bands are documented on
 * PLUNGER in config.ts.
 *
 * `'overshoot'` was added 2026-05-08 to close a visible-vs-logic gap:
 * the PlungerHUD's red zone for DRAW starts at SOFT_STOP_TOLERANCE,
 * but the rules previously treated everything below HARD_OUTCOME as
 * 'soft' success. Now red == overshoot == warning (for DRAW) /
 * partial (for LOAD).
 */
export function plungerOutcome(curve: PlungerCurve): PlungerOutcome {
  if (curve.peakDepth >= PLUNGER.HARD_OUTCOME_THRESHOLD) return 'hard';
  if (curve.peakDepth >= OVERSHOOT_OUTCOME_THRESHOLD) return 'overshoot';
  if (curve.peakDepth >= SOFT_OUTCOME_THRESHOLD) return 'soft';
  if (curve.peakDepth >= PLUNGER.SHORT_OUTCOME_THRESHOLD) return 'short';
  return 'aborted';
}
