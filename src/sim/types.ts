export type Vec3 = readonly [number, number, number];

export type HoverTarget =
  | { kind: 'tip-rack' }
  | { kind: 'sample'; index: number }
  | { kind: 'well'; index: number }
  | { kind: 'trash' }
  | null;

/** A non-null hover — the kind that can be a lock target. */
export type LockTarget = Exclude<HoverTarget, null>;

/**
 * Inner-loop interaction phase. Independent of the outer `WorkflowStep`.
 *
 *   free        cursor moves the pipette; no commitment
 *   committing  camera tweening to ACTION on the locked target
 *   descending  LOAD_WELL only: tip is lowering toward the well; player
 *               presses Space to stop. Three depth zones produce
 *               NOT_LOW_ENOUGH / good / PUNCTURE outcomes.
 *   locked      pipette anchored, plunger HUD visible, awaiting press
 *   acting      plunger is being depressed; plungerCurve advances
 *   finishing   rule has fired; success/warning animation plays out
 */
export type InteractionPhase =
  | 'free'
  | 'committing'
  | 'descending'
  | 'locked'
  | 'acting'
  | 'finishing';

/**
 * Outer workflow step. Canonical home as of Chunk C; `store.ts`
 * re-exports for backward compat.
 */
export enum WorkflowStep {
  GET_TIP = 'GET_TIP',
  DRAW_SAMPLE = 'DRAW_SAMPLE',
  LOAD_WELL = 'LOAD_WELL',
  DISCARD_TIP = 'DISCARD_TIP',
  RUN_GEL = 'RUN_GEL',
  COMPLETE = 'COMPLETE',
}

/**
 * Active failure modes. Decision Log 2026-05-05 retired NOT_LOW_ENOUGH
 * and PUNCTURE; the 2026-05-06 follow-up reactivated them, scoped to the
 * LOAD_WELL `descending` sub-phase only (see docs/followup-2026-05-06.md).
 * SHORT_DRAW also added in that follow-up. SHORT_LOAD added 2026-05-08
 * after a tester report traced empty wells back to silent 'short' ejects
 * — the player thought they had loaded but the dispense never landed.
 */
export type FailureCode =
  | 'NO_TIP'
  | 'HARD_STOP_TO_DRAW'
  | 'EMPTY_EJECT'
  | 'SHORT_DRAW'
  | 'SHORT_LOAD'
  | 'NOT_LOW_ENOUGH'
  | 'PUNCTURE';

/**
 * Active warning modes. LOOSE_TIP added 2026-05-06; OVERDRAW added
 * 2026-05-08 to surface "drew past the click without reaching hard
 * stop" — the PlungerHUD red zone that was previously silent on DRAW.
 */
export type WarningCode =
  | 'SOFT_STOP_TO_EJECT'
  | 'NO_FRESH_TIP'
  | 'WRONG_TUBE'
  | 'LOOSE_TIP'
  | 'OVERDRAW';

/** A warning recorded against a specific lane (well index). */
export interface WarningRecord {
  code: WarningCode;
  lane: number;
}

/**
 * The state shape the rules layer operates on. A subset of the eventual
 * store schema (which lands in C2). Defined here so rule unit tests can
 * exercise rules without booting the store.
 */
export interface RuleState {
  step: WorkflowStep;
  /** 0..WELL_COUNT-1, the tube/well pair the player is working on. */
  activeStep: number;
  hasTip: boolean;
  /** 0..1; portion of FULL volume currently in the tip. */
  liquidInTip: number;
  /** Sample tube the current liquid was drawn from, or null. */
  liquidSourceIndex: number | null;
  /** Per-well DNA volume; length === WELL_COUNT. */
  dnaInWells: number[];
  /**
   * Per-well source — sample tube index that delivered DNA into each
   * well, or null if the well is empty. length === WELL_COUNT. The gel
   * keys band patterns off this so a mislabel (loading sample N into
   * well M, M ≠ N) shows the SAMPLE's pattern in the wrong slot — the
   * way it would on a real gel.
   */
  wellSources: (number | null)[];
  /** Tubes the player has already drawn from (for NO_FRESH_TIP). */
  usedTubes: number[];
  warnings: WarningRecord[];
  failure: FailureCode | null;
  /** Inner phase. */
  interactionPhase: InteractionPhase;
  /** Target captured at lock time, held through finishing. */
  lockedTarget: LockTarget | null;
  /**
   * ms elapsed in the LOAD_WELL `descending` sub-phase. Driven by the
   * controller; rules read it via tryStopDescent. 0 outside descending.
   */
  descentMs: number;
  /**
   * Tap counter for tap-driven actions (GET_TIP triple-tap, DISCARD_TIP
   * single-tap). Driven by the controller; rules read it via tryTapPickup.
   * 0 outside the relevant locked phases.
   */
  tapCount: number;
}
