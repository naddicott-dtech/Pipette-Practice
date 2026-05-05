export const PLUNGER = {
  REST: 0,
  SOFT_STOP: 0.7,
  HARD_STOP: 1.0,
  SOFT_STOP_TOLERANCE: 0.05,
  // Hold timings drive the plunger curve introduced in Chunk C. They
  // replace the LOWER_HOLD_* fields under PIPETTE (which die when
  // depth.ts is removed in C3).
  HOLD_TO_SOFT_MS: 600,
  HOLD_TO_HARD_MS: 1100,
  SOFT_STOP_RESISTANCE_MS: 150, // pause at the soft stop before the curve continues to hard
  // plungerOutcome thresholds — peakDepth ≥ HARD_OUTCOME counts as 'hard'
  // (player pressed past the soft-stop pause to hard); ≥ SOFT_OUTCOME but
  // < HARD_OUTCOME counts as 'soft'; below SOFT_OUTCOME is 'aborted'.
  HARD_OUTCOME_THRESHOLD: 0.95,
} as const;

export const VOLUME = {
  EMPTY_EPS: 0.05,
  FULL: 1.0,
  MAX_UL: 20,
} as const;

export const PIPETTE = {
  Y_HOVER: 3.5,
  Y_LOWERED_TIPS: 0.8,
  Y_LOWERED_SAMPLE: 0.8,
  Y_LOWERED_WELL: 0.4,
  Y_PUNCTURE: 0.05,
  FOLLOW_LERP: 0.1,
  LOWER_HOLD_FULL_MS: 300,
  LOWER_HOLD_PUNCTURE_MS: 600,
} as const;

export const WORKFLOW = {
  WELL_COUNT: 4,
  WELL_SUCCESS_THRESHOLD: 0.5,
  EJECT_RATE_PER_PLUNGER_UNIT: 2,
} as const;

export const LOCK = {
  // Click or Space-press commits the lock instantly. No auto-lock-on-hover.
  COMMIT_HOLD_MS: 0,
} as const;

export const CAMERA = {
  OVERVIEW: { position: [8, 8, 12] as const, fov: 35, lookAt: [0, 0, 0] as const },
  CLOSEUP:  { position: [2, 2, 6]  as const, fov: 28, lookAt: [0, 0, 0] as const },
  TRANSITION_MS: 450,
} as const;
