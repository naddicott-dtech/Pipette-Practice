export const PLUNGER = {
  REST: 0,
  SOFT_STOP: 0.7,
  HARD_STOP: 1.0,
  SOFT_STOP_TOLERANCE: 0.05,
  HOLD_TO_SOFT_MS: 600,
  HOLD_TO_HARD_MS: 1100,
  SOFT_STOP_RESISTANCE_MS: 150,
  // plungerOutcome bands:
  //   < SHORT  → 'aborted' (silent: brief exploratory tap)
  //   < SOFT   → 'short'   (committed press but well shy of the click — fails on DRAW)
  //   < HARD   → 'soft'    (at the click)
  //   ≥ HARD   → 'hard'    (past the click)
  // SHORT sits at 1/4 of the way to the soft stop per the 2026-05-06 follow-up:
  // a half-press should fail rather than silently abort.
  SHORT_OUTCOME_THRESHOLD: 0.175,
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
  // Anchor for the pipette body during DISCARD_TIP. Body center sits at
  // Y_LOWERED_TRASH; the tip apex (offset 2.0 below body center) lands at
  // ~0.5 — mid-beaker (beaker spans world Y ∈ [0.05, 1.25]). Higher than
  // Y_LOWERED_TIPS so the tip doesn't poke through the beaker bottom.
  Y_LOWERED_TRASH: 2.5,
  FOLLOW_LERP: 0.1,
  // LOAD_WELL descent visualization. Tip travels from Y_DESCENT_START
  // (above the buffer surface at world y=0.25) down to Y_DESCENT_PUNCTURE
  // (visibly below the well floor at world y=-0.05) over
  // WORKFLOW.DESCENT.AUTO_PUNCTURE_MS. Numbers chosen so the timing
  // thresholds line up with visible Y landmarks:
  //   t = HIGH_TO_GOOD_MS / AUTO   ≈ 0.6  → tip at buffer surface
  //   t = GOOD_TO_PUNCTURE_MS / AUTO ≈ 0.84 → tip at well floor
  Y_DESCENT_START: 1.0,
  Y_DESCENT_PUNCTURE: -0.25,
} as const;

export const WORKFLOW = {
  WELL_COUNT: 4,
  WELL_SUCCESS_THRESHOLD: 0.5,
  EJECT_RATE_PER_PLUNGER_UNIT: 2,
  FINISHING_ANIMATION_MS: 500,
  // Triple-tap GET_TIP / single-tap DISCARD_TIP. Players press Space
  // multiple times within TAP_WINDOW_MS to seat a tip firmly; one tap
  // alone (then timeout) advances with a LOOSE_TIP warning.
  TAP_TARGET_COUNT: 3,
  TAP_WINDOW_MS: 700,
  /**
   * LOAD_WELL descent timing. After lock, the tip lowers continuously.
   * Player presses Space to stop:
   *   < HIGH_TO_GOOD_MS              → NOT_LOW_ENOUGH (above the agar)
   *   HIGH_TO_GOOD_MS..GOOD_TO_PUNCTURE_MS → in the well, proceed to plunger
   *   ≥ GOOD_TO_PUNCTURE_MS          → PUNCTURE
   * AUTO_PUNCTURE_MS is a hard cap — if the player never presses, the
   * controller fires PUNCTURE so we don't sit forever.
   */
  DESCENT: {
    HIGH_TO_GOOD_MS: 1800,
    GOOD_TO_PUNCTURE_MS: 2520,
    AUTO_PUNCTURE_MS: 3000,
  },
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
