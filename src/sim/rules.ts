/**
 * Pure rules layer. Each function takes a snapshot of `RuleState` plus
 * inputs, returns `{ nextState, events }`. No React, no three.js, no
 * timers, no randomness. Driver code in `src/scene/` calls these in
 * response to player input or frame ticks and applies the patches to
 * the store.
 *
 * Conform to the canonical transition table in docs/fix-plan.md
 * ("Canonical transition table" subsection of Chunk C). Tests in
 * rules.test.ts cover every cell.
 */

import { WORKFLOW } from './config';
import { plungerOutcome, type PlungerCurve, type PlungerOutcome, type PlungerAction } from './plunger';
import {
  WorkflowStep,
  type FailureCode,
  type HoverTarget,
  type LockTarget,
  type RuleState,
  type WarningCode,
} from './types';

// ─── Result shape ──────────────────────────────────────────────────────

export type RuleEvent =
  | { kind: 'STEP_ADVANCED'; nextStep: WorkflowStep }
  | { kind: 'CYCLE_COMPLETE' }
  | { kind: 'RUN_READY' }
  | { kind: 'FAIL'; code: FailureCode }
  | { kind: 'WARN'; code: WarningCode };

export interface Result {
  nextState: Partial<RuleState>;
  events: RuleEvent[];
}

const NOOP: Result = { nextState: {}, events: [] };

// ─── Initial state ──────────────────────────────────────────────────────

export function initialRuleState(): RuleState {
  return {
    step: WorkflowStep.GET_TIP,
    activeStep: 0,
    hasTip: false,
    liquidInTip: 0,
    liquidSourceIndex: null,
    dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0),
    usedTubes: [],
    warnings: [],
    failure: null,
    interactionPhase: 'free',
    lockedTarget: null,
  };
}

/**
 * Reset to a fresh run. Returns a state patch that the driver applies
 * verbatim to clear the store. Used by the failure modal's "Try Again"
 * button and the run debrief's "Run Again" button.
 */
export function reset(): Partial<RuleState> {
  return initialRuleState();
}

// ─── Lock validation ────────────────────────────────────────────────────

type HoverKind = NonNullable<HoverTarget>['kind'];

/**
 * Map a workflow step to the hover kind it accepts for locking. RUN_GEL
 * and COMPLETE accept no hover kinds — interaction is via the start/run
 * buttons, not by locking onto a 3D target.
 */
function expectedKindForStep(step: WorkflowStep): HoverKind | null {
  switch (step) {
    case WorkflowStep.GET_TIP:
      return 'tip-rack';
    case WorkflowStep.INTAKE_SAMPLE:
    case WorkflowStep.DRAW_SAMPLE:
      return 'sample';
    case WorkflowStep.LOAD_WELL:
      return 'well';
    case WorkflowStep.DISCARD_TIP:
      return 'trash';
    case WorkflowStep.RUN_GEL:
    case WorkflowStep.COMPLETE:
      return null;
  }
}

/**
 * Decide whether a click/Space-press while hovering `hover` should
 * commit a lock. Per the canonical transition table:
 *   - hover null or wrong-kind for step → no-op (player nudged in space)
 *   - hover valid AND step is DRAW_SAMPLE AND no tip → fire NO_TIP failure
 *     (lock-and-fail at commit time so the modal explains the contamination)
 *   - otherwise → transition to 'committing' with lockedTarget set
 *
 * The phase-to-locked transition itself is the driver's job (it fires
 * after the camera tween completes).
 */
export function tryLockOnto(state: RuleState, hover: HoverTarget): Result {
  if (state.interactionPhase !== 'free') return NOOP;
  if (hover === null) return NOOP;

  const expected = expectedKindForStep(state.step);
  if (expected === null || hover.kind !== expected) return NOOP;

  // Lock-time failure: drawing without a tip.
  if (
    (state.step === WorkflowStep.DRAW_SAMPLE || state.step === WorkflowStep.INTAKE_SAMPLE) &&
    !state.hasTip
  ) {
    return {
      nextState: {
        failure: 'NO_TIP',
        interactionPhase: 'finishing',
        lockedTarget: hover as LockTarget,
      },
      events: [{ kind: 'FAIL', code: 'NO_TIP' }],
    };
  }

  return {
    nextState: {
      interactionPhase: 'committing',
      lockedTarget: hover as LockTarget,
    },
    events: [],
  };
}

/**
 * Cancel out of a commit, lock, or aborted action. Returns to 'free' and
 * clears lockedTarget. Calling cancel from any other phase is a no-op.
 */
export function tryCancel(state: RuleState): Result {
  if (
    state.interactionPhase === 'committing' ||
    state.interactionPhase === 'locked' ||
    state.interactionPhase === 'acting'
  ) {
    return {
      nextState: { interactionPhase: 'free', lockedTarget: null },
      events: [],
    };
  }
  return NOOP;
}

// ─── Action resolution ──────────────────────────────────────────────────

/**
 * Map a workflow step to the action it performs at the locked target.
 * Used internally by `tryAct` so the driver doesn't have to repeat
 * the dispatch.
 */
function actionForStep(step: WorkflowStep): PlungerAction | null {
  switch (step) {
    case WorkflowStep.GET_TIP:
      return 'pickup';
    case WorkflowStep.INTAKE_SAMPLE:
    case WorkflowStep.DRAW_SAMPLE:
      return 'draw';
    case WorkflowStep.LOAD_WELL:
      return 'eject';
    case WorkflowStep.DISCARD_TIP:
      return 'discard';
    default:
      return null;
  }
}

/**
 * Resolve a completed plunger press into a state patch. Called by the
 * driver on `Space-up` / `mouse-up` while in 'acting' phase.
 *
 * Aborted presses (player released before the soft-stop zone) silently
 * return to 'free' with no rule fired and no warning recorded — the
 * canonical table treats abort as a polite cancellation.
 */
export function tryAct(state: RuleState, curve: PlungerCurve): Result {
  if (state.interactionPhase !== 'acting') return NOOP;
  if (state.lockedTarget === null) return NOOP;

  const action = actionForStep(state.step);
  if (action === null) return NOOP;

  const outcome = plungerOutcome(curve);
  if (outcome === 'aborted') {
    return {
      nextState: { interactionPhase: 'free', lockedTarget: null },
      events: [],
    };
  }

  switch (action) {
    case 'pickup':
      return resolvePickup(state);
    case 'draw':
      return resolveDraw(state, outcome);
    case 'eject':
      return resolveEject(state, outcome);
    case 'discard':
      return resolveDiscard(state);
  }
}

function resolvePickup(state: RuleState): Result {
  // Pickup ignores soft/hard distinction — any non-aborted press picks up.
  if (state.lockedTarget?.kind !== 'tip-rack') return NOOP;
  return {
    nextState: {
      hasTip: true,
      interactionPhase: 'finishing',
    },
    events: [{ kind: 'STEP_ADVANCED', nextStep: WorkflowStep.DRAW_SAMPLE }],
  };
}

function resolveDraw(state: RuleState, outcome: PlungerOutcome): Result {
  if (state.lockedTarget?.kind !== 'sample') return NOOP;
  const tubeIndex = state.lockedTarget.index;

  if (outcome === 'hard') {
    return {
      nextState: {
        failure: 'HARD_STOP_TO_DRAW',
        interactionPhase: 'finishing',
      },
      events: [{ kind: 'FAIL', code: 'HARD_STOP_TO_DRAW' }],
    };
  }

  // Successful draw at the soft stop. Fire warnings for tube reuse or
  // wrong-tube selection BEFORE state mutation so the events list is
  // ordered: warnings first, then STEP_ADVANCED.
  const events: RuleEvent[] = [];
  if (state.usedTubes.includes(tubeIndex)) {
    events.push({ kind: 'WARN', code: 'NO_FRESH_TIP' });
  }
  if (tubeIndex !== state.activeStep) {
    events.push({ kind: 'WARN', code: 'WRONG_TUBE' });
  }

  const newWarnings = [...state.warnings];
  for (const ev of events) {
    if (ev.kind === 'WARN') {
      newWarnings.push({ code: ev.code, lane: state.activeStep });
    }
  }

  events.push({ kind: 'STEP_ADVANCED', nextStep: WorkflowStep.LOAD_WELL });

  return {
    nextState: {
      liquidInTip: 1,
      liquidSourceIndex: tubeIndex,
      usedTubes: [...state.usedTubes, tubeIndex],
      warnings: newWarnings,
      interactionPhase: 'finishing',
    },
    events,
  };
}

function resolveEject(state: RuleState, outcome: PlungerOutcome): Result {
  if (state.lockedTarget?.kind !== 'well') return NOOP;
  const wellIndex = state.lockedTarget.index;

  // Empty tip — failure regardless of soft/hard.
  if (state.liquidInTip <= 0) {
    return {
      nextState: {
        failure: 'EMPTY_EJECT',
        interactionPhase: 'finishing',
      },
      events: [{ kind: 'FAIL', code: 'EMPTY_EJECT' }],
    };
  }

  // Wrong-well variant: same lane-mislabel pedagogy as WRONG_TUBE,
  // surfaced when the player loads into a non-active well. We reuse
  // the WRONG_TUBE code (per Decision Log "WRONG_TUBE replaces the
  // conceptual gap left by retiring NOT_LOW_ENOUGH" — the rule fires
  // at either the draw or load mismatch, whichever happens).
  const wrongLane = wellIndex !== state.activeStep;
  const events: RuleEvent[] = [];
  const newWarnings = [...state.warnings];
  if (wrongLane) {
    events.push({ kind: 'WARN', code: 'WRONG_TUBE' });
    newWarnings.push({ code: 'WRONG_TUBE', lane: wellIndex });
  }

  // Soft-stop eject delivers half volume; hard-stop delivers full.
  const delivered = outcome === 'soft' ? state.liquidInTip * 0.5 : state.liquidInTip;
  if (outcome === 'soft') {
    events.push({ kind: 'WARN', code: 'SOFT_STOP_TO_EJECT' });
    newWarnings.push({ code: 'SOFT_STOP_TO_EJECT', lane: wellIndex });
  }

  const nextWells = [...state.dnaInWells];
  nextWells[wellIndex] = Math.min(1, nextWells[wellIndex] + delivered);

  events.push({ kind: 'STEP_ADVANCED', nextStep: WorkflowStep.DISCARD_TIP });

  return {
    nextState: {
      dnaInWells: nextWells,
      liquidInTip: Math.max(0, state.liquidInTip - delivered),
      // If the tip is now empty, clear the source index to avoid stale data.
      liquidSourceIndex:
        state.liquidInTip - delivered <= 0 ? null : state.liquidSourceIndex,
      warnings: newWarnings,
      interactionPhase: 'finishing',
    },
    events,
  };
}

function resolveDiscard(state: RuleState): Result {
  if (state.lockedTarget?.kind !== 'trash') return NOOP;
  // Discard always succeeds. Tip is removed; any residual liquid is
  // cleared (in real life it goes in the trash).
  return {
    nextState: {
      hasTip: false,
      liquidInTip: 0,
      liquidSourceIndex: null,
      interactionPhase: 'finishing',
    },
    events: [],
  };
}

// ─── Step progression ───────────────────────────────────────────────────

/**
 * Called by the driver when the finishing animation completes. Decides
 * what comes next: advance step within a cycle, start a new cycle, or
 * transition to RUN_GEL when all wells are loaded.
 *
 * Failures are sticky — `state.failure !== null` means the modal is
 * open and only `reset()` can clear it. `advanceFromFinishing` is a
 * no-op until the player clicks "Try Again".
 */
export function advanceFromFinishing(state: RuleState): Result {
  if (state.interactionPhase !== 'finishing') return NOOP;
  if (state.failure !== null) return NOOP;

  // End of a cycle — discard succeeded.
  if (state.step === WorkflowStep.DISCARD_TIP) {
    if (state.activeStep + 1 < WORKFLOW.WELL_COUNT) {
      return {
        nextState: {
          step: WorkflowStep.GET_TIP,
          activeStep: state.activeStep + 1,
          interactionPhase: 'free',
          lockedTarget: null,
        },
        events: [
          { kind: 'CYCLE_COMPLETE' },
          { kind: 'STEP_ADVANCED', nextStep: WorkflowStep.GET_TIP },
        ],
      };
    }
    return {
      nextState: {
        step: WorkflowStep.RUN_GEL,
        interactionPhase: 'free',
        lockedTarget: null,
      },
      events: [{ kind: 'CYCLE_COMPLETE' }, { kind: 'RUN_READY' }],
    };
  }

  // Within a cycle.
  const next = nextStepWithinCycle(state.step);
  if (next === null) {
    // RUN_GEL or COMPLETE — no further progression from finishing.
    return {
      nextState: { interactionPhase: 'free', lockedTarget: null },
      events: [],
    };
  }
  return {
    nextState: {
      step: next,
      interactionPhase: 'free',
      lockedTarget: null,
    },
    events: [{ kind: 'STEP_ADVANCED', nextStep: next }],
  };
}

function nextStepWithinCycle(step: WorkflowStep): WorkflowStep | null {
  switch (step) {
    case WorkflowStep.GET_TIP:
      return WorkflowStep.DRAW_SAMPLE;
    case WorkflowStep.INTAKE_SAMPLE:
    case WorkflowStep.DRAW_SAMPLE:
      return WorkflowStep.LOAD_WELL;
    case WorkflowStep.LOAD_WELL:
      return WorkflowStep.DISCARD_TIP;
    case WorkflowStep.DISCARD_TIP:
    case WorkflowStep.RUN_GEL:
    case WorkflowStep.COMPLETE:
      // DISCARD_TIP is handled at the top of advanceFromFinishing; the others
      // have no in-cycle successor.
      return null;
  }
}

// ─── Test helpers ───────────────────────────────────────────────────────

/** Apply a Result's nextState patch to a starting state. Used in tests. */
export function applyPatch(base: RuleState, patch: Partial<RuleState>): RuleState {
  return { ...base, ...patch };
}
