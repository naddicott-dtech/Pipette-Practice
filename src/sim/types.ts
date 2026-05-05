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
 *   free       cursor moves the pipette; no commitment
 *   committing camera tweening to ACTION on the locked target
 *   locked     pipette anchored, plunger HUD visible, awaiting press
 *   acting     plunger is being depressed; plungerCurve advances
 *   finishing  rule has fired; success/warning animation plays out
 *
 * The driver moves the phase in response to events; rules return
 * `nextState.interactionPhase` patches per the canonical transition
 * table in docs/fix-plan.md.
 */
export type InteractionPhase = 'free' | 'committing' | 'locked' | 'acting' | 'finishing';

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

/** Active failure modes per the Decision Log (2026-05-05). */
export type FailureCode = 'NO_TIP' | 'HARD_STOP_TO_DRAW' | 'EMPTY_EJECT';

/** Active warning modes per the Decision Log (2026-05-05). */
export type WarningCode = 'SOFT_STOP_TO_EJECT' | 'NO_FRESH_TIP' | 'WRONG_TUBE';

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
  /** Tubes the player has already drawn from (for NO_FRESH_TIP). */
  usedTubes: number[];
  warnings: WarningRecord[];
  failure: FailureCode | null;
  /** Inner phase. */
  interactionPhase: InteractionPhase;
  /** Target captured at lock time, held through finishing. */
  lockedTarget: LockTarget | null;
}
