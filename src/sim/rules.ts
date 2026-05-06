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

import { WORKFLOW, RUN_DURATION_MS } from './config';
import { plungerOutcome, type PlungerCurve, type PlungerOutcome } from './plunger';
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
    wellSources: Array(WORKFLOW.WELL_COUNT).fill(null),
    usedTubes: [],
    warnings: [],
    failure: null,
    interactionPhase: 'free',
    lockedTarget: null,
    descentMs: 0,
    tapCount: 0,
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
  if (state.step === WorkflowStep.DRAW_SAMPLE && !state.hasTip) {
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
 * Cancel out of a commit, lock, descent, or aborted action. Returns to
 * 'free' and clears lockedTarget plus any in-flight descent / tap counter.
 */
export function tryCancel(state: RuleState): Result {
  if (
    state.interactionPhase === 'committing' ||
    state.interactionPhase === 'descending' ||
    state.interactionPhase === 'locked' ||
    state.interactionPhase === 'acting'
  ) {
    return {
      nextState: {
        interactionPhase: 'free',
        lockedTarget: null,
        descentMs: 0,
        tapCount: 0,
      },
      events: [],
    };
  }
  return NOOP;
}

// ─── Action resolution ──────────────────────────────────────────────────

/**
 * Resolve a completed plunger press into a state patch. Called by the
 * driver on `Space-up` / `mouse-up` while in 'acting' phase. Only DRAW
 * and LOAD_WELL eject route through here — pickup and discard are
 * tap-driven and have their own entry points.
 */
export function tryAct(state: RuleState, curve: PlungerCurve): Result {
  if (state.interactionPhase !== 'acting') return NOOP;
  if (state.lockedTarget === null) return NOOP;

  const outcome = plungerOutcome(curve);
  if (outcome === 'aborted') {
    return {
      nextState: { interactionPhase: 'free', lockedTarget: null },
      events: [],
    };
  }

  switch (state.step) {
    case WorkflowStep.DRAW_SAMPLE:
      return resolveDraw(state, outcome);
    case WorkflowStep.LOAD_WELL:
      return resolveEject(state, outcome);
    default:
      // GET_TIP and DISCARD_TIP arrive here only if the controller is
      // misrouting input — they should use tryTapPickup / tryTapDiscard.
      return NOOP;
  }
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

  if (outcome === 'short') {
    return {
      nextState: {
        failure: 'SHORT_DRAW',
        interactionPhase: 'finishing',
      },
      events: [{ kind: 'FAIL', code: 'SHORT_DRAW' }],
    };
  }

  // Successful draw (soft or overshoot). For overshoot the volume is
  // still drawn — the player did seal the air column past the click,
  // they just took up more than intended. Fire OVERDRAW so the player
  // gets a signal matching the PlungerHUD's red zone.
  const events: RuleEvent[] = [];
  if (outcome === 'overshoot') {
    events.push({ kind: 'WARN', code: 'OVERDRAW' });
  }
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

  // A 'short' eject is a brief press that didn't reach the soft stop —
  // no liquid actually leaves the tip. Pre-2026-05-08 this returned
  // silently to 'free' and left the player without a signal that
  // nothing happened. The tester report traced "wells 3 & 4 show no
  // bands" back to the player thinking they had loaded when they
  // hadn't. SHORT_LOAD now halts with a modal so the empty-well case
  // is impossible to mistake.
  if (outcome === 'short') {
    return {
      nextState: {
        failure: 'SHORT_LOAD',
        interactionPhase: 'finishing',
      },
      events: [{ kind: 'FAIL', code: 'SHORT_LOAD' }],
    };
  }

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

  // Wrong-well variant: lane-mismatch warning. Independent of the
  // depth-based NOT_LOW_ENOUGH/PUNCTURE failures, which fire during the
  // descent sub-phase before the eject is even attempted.
  const wrongLane = wellIndex !== state.activeStep;
  const events: RuleEvent[] = [];
  const newWarnings = [...state.warnings];
  if (wrongLane) {
    events.push({ kind: 'WARN', code: 'WRONG_TUBE' });
    newWarnings.push({ code: 'WRONG_TUBE', lane: wellIndex });
  }

  // Soft / overshoot ejects deliver half volume + SOFT_STOP_TO_EJECT
  // warning; only a hard-stop press delivers the full sample. The
  // overshoot band on the plunger curve maps to "past the click but
  // not yet at hard stop" — same partial-delivery outcome as soft for
  // a real micropipette, since the blow-out only happens at the hard
  // stop. (For DRAW, overshoot is its own warning with full volume —
  // see resolveDraw — because there the issue is *too much* volume,
  // not too little.)
  const isPartialEject = outcome === 'soft' || outcome === 'overshoot';
  const delivered = isPartialEject ? state.liquidInTip * 0.5 : state.liquidInTip;
  if (isPartialEject) {
    events.push({ kind: 'WARN', code: 'SOFT_STOP_TO_EJECT' });
    newWarnings.push({ code: 'SOFT_STOP_TO_EJECT', lane: wellIndex });
  }

  const nextWells = [...state.dnaInWells];
  nextWells[wellIndex] = Math.min(1, nextWells[wellIndex] + delivered);

  // Record which sample landed in this well. The first delivery wins —
  // a second eject into an already-loaded well doesn't overwrite the
  // source (the dnaInWells cap at 1 already silently drops the second
  // sample's volume; we mirror that for the source). This keeps a
  // mislabeled load visible on the gel as the wrong sample's pattern
  // in the wrong slot.
  const nextSources = [...state.wellSources];
  if (nextSources[wellIndex] === null) {
    nextSources[wellIndex] = state.liquidSourceIndex;
  }

  events.push({ kind: 'STEP_ADVANCED', nextStep: WorkflowStep.DISCARD_TIP });

  return {
    nextState: {
      dnaInWells: nextWells,
      wellSources: nextSources,
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

// ─── Tap-driven actions (GET_TIP pickup, DISCARD_TIP eject) ─────────────

/**
 * Pick up a tip from the rack. Tap-driven (real micropipettes use a
 * "tap-tap-tap" seating motion, not a plunger press). Called by the
 * controller when either:
 *   - the player completes TAP_TARGET_COUNT taps within the window
 *     (`firm: true`) — no warning
 *   - the tap window times out at exactly 1 tap (`firm: false`) —
 *     LOOSE_TIP warning, but the workflow still advances
 */
export function tryTapPickup(state: RuleState, firm: boolean): Result {
  if (state.interactionPhase !== 'locked') return NOOP;
  if (state.step !== WorkflowStep.GET_TIP) return NOOP;
  if (state.lockedTarget?.kind !== 'tip-rack') return NOOP;

  const events: RuleEvent[] = [];
  const patch: Partial<RuleState> = {
    hasTip: true,
    interactionPhase: 'finishing',
    tapCount: 0,
  };
  if (!firm) {
    events.push({ kind: 'WARN', code: 'LOOSE_TIP' });
    patch.warnings = [...state.warnings, { code: 'LOOSE_TIP', lane: state.activeStep }];
  }
  events.push({ kind: 'STEP_ADVANCED', nextStep: WorkflowStep.DRAW_SAMPLE });

  return { nextState: patch, events };
}

/**
 * Discard the tip into the trash. Tap-driven (real micropipettes have a
 * dedicated eject button — single press, tip flies off). Called by the
 * controller on the first Space-press in `locked` for DISCARD_TIP.
 */
export function tryTapDiscard(state: RuleState): Result {
  if (state.interactionPhase !== 'locked') return NOOP;
  if (state.step !== WorkflowStep.DISCARD_TIP) return NOOP;
  if (state.lockedTarget?.kind !== 'trash') return NOOP;

  return {
    nextState: {
      hasTip: false,
      liquidInTip: 0,
      liquidSourceIndex: null,
      interactionPhase: 'finishing',
      tapCount: 0,
    },
    events: [],
  };
}

// ─── Descent (LOAD_WELL only) ───────────────────────────────────────────

/**
 * Resolve the LOAD_WELL descent at the moment the player presses Space
 * (or auto-fires at AUTO_PUNCTURE_MS). Three zones, evaluated against
 * `descentMs`:
 *   < HIGH_TO_GOOD_MS              → NOT_LOW_ENOUGH failure
 *   < GOOD_TO_PUNCTURE_MS          → transition to 'locked' for plunger press
 *   ≥ GOOD_TO_PUNCTURE_MS          → PUNCTURE failure
 */
export function tryStopDescent(state: RuleState, descentMs: number): Result {
  if (state.interactionPhase !== 'descending') return NOOP;
  if (state.step !== WorkflowStep.LOAD_WELL) return NOOP;
  if (state.lockedTarget?.kind !== 'well') return NOOP;

  if (descentMs < WORKFLOW.DESCENT.HIGH_TO_GOOD_MS) {
    return {
      nextState: {
        failure: 'NOT_LOW_ENOUGH',
        interactionPhase: 'finishing',
      },
      events: [{ kind: 'FAIL', code: 'NOT_LOW_ENOUGH' }],
    };
  }
  if (descentMs >= WORKFLOW.DESCENT.GOOD_TO_PUNCTURE_MS) {
    return {
      nextState: {
        failure: 'PUNCTURE',
        interactionPhase: 'finishing',
      },
      events: [{ kind: 'FAIL', code: 'PUNCTURE' }],
    };
  }
  // Good zone — proceed to plunger press.
  return {
    nextState: { interactionPhase: 'locked' },
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
          descentMs: 0,
          tapCount: 0,
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
        descentMs: 0,
        tapCount: 0,
      },
      events: [{ kind: 'CYCLE_COMPLETE' }, { kind: 'RUN_READY' }],
    };
  }

  // Within a cycle.
  const next = nextStepWithinCycle(state.step);
  if (next === null) {
    // RUN_GEL or COMPLETE — no further progression from finishing.
    return {
      nextState: {
        interactionPhase: 'free',
        lockedTarget: null,
        descentMs: 0,
        tapCount: 0,
      },
      events: [],
    };
  }
  return {
    nextState: {
      step: next,
      interactionPhase: 'free',
      lockedTarget: null,
      descentMs: 0,
      tapCount: 0,
    },
    events: [{ kind: 'STEP_ADVANCED', nextStep: next }],
  };
}

function nextStepWithinCycle(step: WorkflowStep): WorkflowStep | null {
  switch (step) {
    case WorkflowStep.GET_TIP:
      return WorkflowStep.DRAW_SAMPLE;
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

/**
 * Advance the run while step === RUN_GEL. Called from a useFrame in the
 * scene driver every frame. Once `elapsedMs` reaches the configured
 * run duration, fires `STEP_ADVANCED` with `WorkflowStep.COMPLETE` and
 * patches `step`. Below that threshold it's a no-op.
 *
 * Importantly, the rule layer doesn't know about wall-clock time on its
 * own — `elapsedMs` is computed by the driver as `now - runStartedAt`.
 * That keeps the rules pure (no clock dependencies in tests).
 */
export function tickRun(state: RuleState, elapsedMs: number): Result {
  if (state.step !== WorkflowStep.RUN_GEL) return NOOP;
  if (elapsedMs < RUN_DURATION_MS) return NOOP;
  return {
    nextState: { step: WorkflowStep.COMPLETE },
    events: [{ kind: 'STEP_ADVANCED', nextStep: WorkflowStep.COMPLETE }],
  };
}

/** Apply a Result's nextState patch to a starting state. Used in tests. */
export function applyPatch(base: RuleState, patch: Partial<RuleState>): RuleState {
  return { ...base, ...patch };
}
