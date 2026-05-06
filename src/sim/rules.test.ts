import { describe, it, expect } from 'vitest';
import {
  initialRuleState,
  reset,
  tryLockOnto,
  tryCancel,
  tryAct,
  tryTapPickup,
  tryTapDiscard,
  tryStopDescent,
  tickRun,
  advanceFromFinishing,
  applyPatch,
  type Result,
  type RuleEvent,
} from './rules';
import { startCurve, tickCurve, type PlungerCurve } from './plunger';
import {
  WorkflowStep,
  type RuleState,
  type HoverTarget,
} from './types';
import { PLUNGER, WORKFLOW, RUN_DURATION_MS } from './config';

// ─── Test helpers ───────────────────────────────────────────────────────

function state(overrides: Partial<RuleState> = {}): RuleState {
  return { ...initialRuleState(), ...overrides };
}

function curveFor(holdMs: number): PlungerCurve {
  let c = startCurve(0);
  c = tickCurve(c, holdMs);
  return c;
}

const SOFT_PRESS_MS = PLUNGER.HOLD_TO_SOFT_MS + Math.floor(PLUNGER.SOFT_STOP_RESISTANCE_MS / 2);
const HARD_PRESS_MS = PLUNGER.HOLD_TO_HARD_MS;
const SHORT_PRESS_MS = Math.floor(PLUNGER.HOLD_TO_SOFT_MS * 0.4); // ≈40% of soft → 'short'
const ABORTED_PRESS_MS = 50; // ≈8% of soft → 'aborted'

const GOOD_DESCENT_MS =
  Math.floor((WORKFLOW.DESCENT.HIGH_TO_GOOD_MS + WORKFLOW.DESCENT.GOOD_TO_PUNCTURE_MS) / 2);
const TOO_HIGH_DESCENT_MS = Math.floor(WORKFLOW.DESCENT.HIGH_TO_GOOD_MS / 2);
const PUNCTURE_DESCENT_MS = WORKFLOW.DESCENT.GOOD_TO_PUNCTURE_MS + 50;

function eventCodes(events: RuleEvent[]): string[] {
  return events.map((e) =>
    e.kind === 'WARN' || e.kind === 'FAIL' ? `${e.kind}:${e.code}` : e.kind,
  );
}

// ─── tryLockOnto ────────────────────────────────────────────────────────

describe('tryLockOnto', () => {
  it('rejects null hover', () => {
    const r = tryLockOnto(state(), null);
    expect(r.nextState).toEqual({});
    expect(r.events).toEqual([]);
  });

  it('rejects hover whose kind does not match the step', () => {
    const r = tryLockOnto(state({ step: WorkflowStep.GET_TIP }), { kind: 'sample', index: 0 });
    expect(r.nextState).toEqual({});
  });

  it('rejects locking from a non-free interaction phase', () => {
    const r = tryLockOnto(
      state({ interactionPhase: 'locked' }),
      { kind: 'tip-rack' },
    );
    expect(r.nextState).toEqual({});
  });

  it('locks onto the tip rack during GET_TIP', () => {
    const r = tryLockOnto(state({ step: WorkflowStep.GET_TIP }), { kind: 'tip-rack' });
    expect(r.nextState.interactionPhase).toBe('committing');
    expect(r.nextState.lockedTarget).toEqual({ kind: 'tip-rack' });
  });

  it('locks onto a sample tube during DRAW_SAMPLE', () => {
    const r = tryLockOnto(
      state({ step: WorkflowStep.DRAW_SAMPLE, hasTip: true }),
      { kind: 'sample', index: 0 },
    );
    expect(r.nextState.interactionPhase).toBe('committing');
    expect(r.nextState.lockedTarget).toEqual({ kind: 'sample', index: 0 });
  });

  it('locks onto a well during LOAD_WELL', () => {
    const r = tryLockOnto(
      state({ step: WorkflowStep.LOAD_WELL, hasTip: true, liquidInTip: 1 }),
      { kind: 'well', index: 1 },
    );
    expect(r.nextState.interactionPhase).toBe('committing');
    expect(r.nextState.lockedTarget).toEqual({ kind: 'well', index: 1 });
  });

  it('locks onto trash during DISCARD_TIP', () => {
    const r = tryLockOnto(
      state({ step: WorkflowStep.DISCARD_TIP, hasTip: true }),
      { kind: 'trash' },
    );
    expect(r.nextState.interactionPhase).toBe('committing');
    expect(r.nextState.lockedTarget).toEqual({ kind: 'trash' });
  });

  it('rejects lock during RUN_GEL (no hover kind matches)', () => {
    const r = tryLockOnto(state({ step: WorkflowStep.RUN_GEL }), { kind: 'tip-rack' });
    expect(r.nextState).toEqual({});
  });

  it('fires NO_TIP failure when locking onto a sample without a tip', () => {
    const r = tryLockOnto(
      state({ step: WorkflowStep.DRAW_SAMPLE, hasTip: false }),
      { kind: 'sample', index: 0 },
    );
    expect(r.nextState.failure).toBe('NO_TIP');
    expect(r.nextState.interactionPhase).toBe('finishing');
    expect(r.events).toEqual([{ kind: 'FAIL', code: 'NO_TIP' }]);
  });

  it('NO_TIP is not fired when locking onto wells or tip rack without a tip', () => {
    expect(tryLockOnto(state({ step: WorkflowStep.GET_TIP, hasTip: false }), { kind: 'tip-rack' })
      .nextState.failure).toBeUndefined();
  });
});

// ─── tryCancel ──────────────────────────────────────────────────────────

describe('tryCancel', () => {
  it('returns to free from committing', () => {
    const r = tryCancel(state({ interactionPhase: 'committing', lockedTarget: { kind: 'tip-rack' } }));
    expect(r.nextState.interactionPhase).toBe('free');
    expect(r.nextState.lockedTarget).toBeNull();
  });

  it('returns to free from descending and clears descentMs', () => {
    const r = tryCancel(state({
      interactionPhase: 'descending',
      lockedTarget: { kind: 'well', index: 0 },
      descentMs: 800,
    }));
    expect(r.nextState.interactionPhase).toBe('free');
    expect(r.nextState.descentMs).toBe(0);
  });

  it('returns to free from locked and clears tapCount', () => {
    const r = tryCancel(state({
      interactionPhase: 'locked',
      lockedTarget: { kind: 'tip-rack' },
      tapCount: 2,
    }));
    expect(r.nextState.interactionPhase).toBe('free');
    expect(r.nextState.lockedTarget).toBeNull();
    expect(r.nextState.tapCount).toBe(0);
  });

  it('returns to free from acting (discards in-flight press)', () => {
    const r = tryCancel(state({ interactionPhase: 'acting', lockedTarget: { kind: 'tip-rack' } }));
    expect(r.nextState.interactionPhase).toBe('free');
  });

  it('is a no-op from free', () => {
    expect(tryCancel(state()).nextState).toEqual({});
  });

  it('is a no-op from finishing', () => {
    expect(tryCancel(state({ interactionPhase: 'finishing' })).nextState).toEqual({});
  });
});

// ─── tryTapPickup (GET_TIP, replaces tryAct/pickup) ─────────────────────

describe('tryTapPickup', () => {
  const base = state({
    step: WorkflowStep.GET_TIP,
    interactionPhase: 'locked',
    lockedTarget: { kind: 'tip-rack' },
  });

  it('firm pickup advances to DRAW_SAMPLE with no warning', () => {
    const r = tryTapPickup(base, true);
    expect(r.nextState.hasTip).toBe(true);
    expect(r.nextState.interactionPhase).toBe('finishing');
    expect(r.nextState.tapCount).toBe(0);
    expect(eventCodes(r.events)).toEqual(['STEP_ADVANCED']);
    expect(r.nextState.warnings).toBeUndefined();
  });

  it('non-firm pickup fires LOOSE_TIP warning but still advances', () => {
    const r = tryTapPickup(base, false);
    expect(r.nextState.hasTip).toBe(true);
    expect(r.nextState.interactionPhase).toBe('finishing');
    expect(eventCodes(r.events)).toContain('WARN:LOOSE_TIP');
    expect(eventCodes(r.events)).toContain('STEP_ADVANCED');
    expect(r.nextState.warnings?.[0]).toEqual({ code: 'LOOSE_TIP', lane: 0 });
  });

  it('is a no-op outside locked GET_TIP', () => {
    expect(tryTapPickup(state(), true).nextState).toEqual({});
    expect(tryTapPickup(state({ step: WorkflowStep.GET_TIP, interactionPhase: 'free' }), true).nextState).toEqual({});
  });
});

// ─── tryTapDiscard (DISCARD_TIP, replaces tryAct/discard) ───────────────

describe('tryTapDiscard', () => {
  const base = state({
    step: WorkflowStep.DISCARD_TIP,
    hasTip: true,
    liquidInTip: 0.2,
    interactionPhase: 'locked',
    lockedTarget: { kind: 'trash' },
  });

  it('discards the tip and clears residual liquid', () => {
    const r = tryTapDiscard(base);
    expect(r.nextState.hasTip).toBe(false);
    expect(r.nextState.liquidInTip).toBe(0);
    expect(r.nextState.liquidSourceIndex).toBeNull();
    expect(r.nextState.interactionPhase).toBe('finishing');
  });

  it('is a no-op outside locked DISCARD_TIP', () => {
    expect(tryTapDiscard(state()).nextState).toEqual({});
  });
});

// ─── tryStopDescent (LOAD_WELL descent gate) ────────────────────────────

describe('tryStopDescent', () => {
  const base = state({
    step: WorkflowStep.LOAD_WELL,
    hasTip: true,
    liquidInTip: 1,
    liquidSourceIndex: 0,
    interactionPhase: 'descending',
    lockedTarget: { kind: 'well', index: 0 },
    activeStep: 0,
  });

  it('stopping too high fires NOT_LOW_ENOUGH', () => {
    const r = tryStopDescent(base, TOO_HIGH_DESCENT_MS);
    expect(r.nextState.failure).toBe('NOT_LOW_ENOUGH');
    expect(r.nextState.interactionPhase).toBe('finishing');
    expect(eventCodes(r.events)).toEqual(['FAIL:NOT_LOW_ENOUGH']);
  });

  it('stopping in the good zone advances to locked for plunger press', () => {
    const r = tryStopDescent(base, GOOD_DESCENT_MS);
    expect(r.nextState.interactionPhase).toBe('locked');
    expect(r.nextState.failure).toBeUndefined();
  });

  it('stopping (or auto-firing) past GOOD_TO_PUNCTURE_MS fires PUNCTURE', () => {
    const r = tryStopDescent(base, PUNCTURE_DESCENT_MS);
    expect(r.nextState.failure).toBe('PUNCTURE');
    expect(eventCodes(r.events)).toEqual(['FAIL:PUNCTURE']);
  });

  it('is a no-op outside descending LOAD_WELL', () => {
    expect(tryStopDescent(state(), GOOD_DESCENT_MS).nextState).toEqual({});
    expect(tryStopDescent(state({ ...base, interactionPhase: 'locked' }), GOOD_DESCENT_MS).nextState).toEqual({});
  });
});

// ─── tryAct: draw ───────────────────────────────────────────────────────

describe('tryAct (draw, DRAW_SAMPLE)', () => {
  function drawState(overrides: Partial<RuleState> = {}): RuleState {
    return state({
      step: WorkflowStep.DRAW_SAMPLE,
      hasTip: true,
      interactionPhase: 'acting',
      lockedTarget: { kind: 'sample', index: 0 },
      activeStep: 0,
      ...overrides,
    });
  }

  it('aborted press returns to free with no liquid drawn', () => {
    const r = tryAct(drawState(), curveFor(ABORTED_PRESS_MS));
    expect(r.nextState.interactionPhase).toBe('free');
    expect(r.nextState.liquidInTip).toBeUndefined();
  });

  it('short press fires SHORT_DRAW failure (no liquid)', () => {
    const r = tryAct(drawState(), curveFor(SHORT_PRESS_MS));
    expect(r.nextState.failure).toBe('SHORT_DRAW');
    expect(r.nextState.liquidInTip).toBeUndefined();
    expect(eventCodes(r.events)).toContain('FAIL:SHORT_DRAW');
  });

  it('soft press fills the tip and advances to LOAD_WELL', () => {
    const r = tryAct(drawState(), curveFor(SOFT_PRESS_MS));
    expect(r.nextState.liquidInTip).toBe(1);
    expect(r.nextState.liquidSourceIndex).toBe(0);
    expect(eventCodes(r.events)).toContain('STEP_ADVANCED');
  });

  it('hard press fires HARD_STOP_TO_DRAW failure (no liquid drawn)', () => {
    const r = tryAct(drawState(), curveFor(HARD_PRESS_MS));
    expect(r.nextState.failure).toBe('HARD_STOP_TO_DRAW');
    expect(r.nextState.liquidInTip).toBeUndefined();
    expect(eventCodes(r.events)).toContain('FAIL:HARD_STOP_TO_DRAW');
  });

  it('drawing from the wrong tube fires WRONG_TUBE warning but still draws', () => {
    const r = tryAct(
      drawState({ activeStep: 1, lockedTarget: { kind: 'sample', index: 2 } }),
      curveFor(SOFT_PRESS_MS),
    );
    expect(r.nextState.liquidInTip).toBe(1);
    expect(eventCodes(r.events)).toContain('WARN:WRONG_TUBE');
    expect(r.nextState.warnings).toEqual([{ code: 'WRONG_TUBE', lane: 1 }]);
  });

  it('drawing from a tube already used fires NO_FRESH_TIP warning', () => {
    const r = tryAct(
      drawState({ activeStep: 1, usedTubes: [0], lockedTarget: { kind: 'sample', index: 0 } }),
      curveFor(SOFT_PRESS_MS),
    );
    expect(eventCodes(r.events)).toContain('WARN:NO_FRESH_TIP');
    expect(r.nextState.warnings?.[0]).toEqual({ code: 'NO_FRESH_TIP', lane: 1 });
  });

  it('records the tube as used after a successful draw', () => {
    const r = tryAct(drawState(), curveFor(SOFT_PRESS_MS));
    expect(r.nextState.usedTubes).toEqual([0]);
  });

  it('NO_FRESH_TIP and WRONG_TUBE can compound', () => {
    const r = tryAct(
      drawState({ activeStep: 2, usedTubes: [0], lockedTarget: { kind: 'sample', index: 0 } }),
      curveFor(SOFT_PRESS_MS),
    );
    const codes = eventCodes(r.events);
    expect(codes).toContain('WARN:NO_FRESH_TIP');
    expect(codes).toContain('WARN:WRONG_TUBE');
  });
});

// ─── tryAct: eject ──────────────────────────────────────────────────────

describe('tryAct (eject, LOAD_WELL)', () => {
  function loadState(overrides: Partial<RuleState> = {}): RuleState {
    return state({
      step: WorkflowStep.LOAD_WELL,
      hasTip: true,
      liquidInTip: 1,
      liquidSourceIndex: 0,
      interactionPhase: 'acting',
      lockedTarget: { kind: 'well', index: 0 },
      activeStep: 0,
      ...overrides,
    });
  }

  it('aborted press returns to free with no DNA delivered', () => {
    const r = tryAct(loadState(), curveFor(ABORTED_PRESS_MS));
    expect(r.nextState.interactionPhase).toBe('free');
    expect(r.nextState.dnaInWells).toBeUndefined();
  });

  it('short press also returns to free without firing a failure', () => {
    const r = tryAct(loadState(), curveFor(SHORT_PRESS_MS));
    expect(r.nextState.interactionPhase).toBe('free');
    expect(r.nextState.failure).toBeUndefined();
    expect(r.nextState.dnaInWells).toBeUndefined();
  });

  it('hard press delivers full volume and advances to DISCARD_TIP', () => {
    const r = tryAct(loadState(), curveFor(HARD_PRESS_MS));
    expect(r.nextState.dnaInWells?.[0]).toBe(1);
    expect(r.nextState.liquidInTip).toBe(0);
    expect(eventCodes(r.events)).toContain('STEP_ADVANCED');
  });

  it('soft press delivers half volume and fires SOFT_STOP_TO_EJECT warning', () => {
    const r = tryAct(loadState(), curveFor(SOFT_PRESS_MS));
    expect(r.nextState.dnaInWells?.[0]).toBe(0.5);
    expect(r.nextState.liquidInTip).toBe(0.5);
    expect(eventCodes(r.events)).toContain('WARN:SOFT_STOP_TO_EJECT');
  });

  it('ejecting an empty tip fires EMPTY_EJECT failure', () => {
    const r = tryAct(loadState({ liquidInTip: 0 }), curveFor(HARD_PRESS_MS));
    expect(r.nextState.failure).toBe('EMPTY_EJECT');
    expect(eventCodes(r.events)).toContain('FAIL:EMPTY_EJECT');
  });

  it('loading into the wrong well fires WRONG_TUBE warning but still delivers', () => {
    const r = tryAct(
      loadState({ activeStep: 1, lockedTarget: { kind: 'well', index: 2 } }),
      curveFor(HARD_PRESS_MS),
    );
    expect(r.nextState.dnaInWells?.[2]).toBe(1);
    expect(eventCodes(r.events)).toContain('WARN:WRONG_TUBE');
  });

  it('clears liquidSourceIndex when the tip empties', () => {
    const r = tryAct(loadState(), curveFor(HARD_PRESS_MS));
    expect(r.nextState.liquidSourceIndex).toBeNull();
  });

  it('preserves liquidSourceIndex on partial (soft) eject', () => {
    const r = tryAct(loadState(), curveFor(SOFT_PRESS_MS));
    expect(r.nextState.liquidSourceIndex).toBe(0);
  });
});

// ─── tryAct: routing ────────────────────────────────────────────────────

describe('tryAct routing', () => {
  it('is a no-op for GET_TIP (tap-driven, not plunger-driven)', () => {
    const r = tryAct(
      state({
        step: WorkflowStep.GET_TIP,
        interactionPhase: 'acting',
        lockedTarget: { kind: 'tip-rack' },
      }),
      curveFor(SOFT_PRESS_MS),
    );
    expect(r.nextState).toEqual({});
  });

  it('is a no-op for DISCARD_TIP (tap-driven, not plunger-driven)', () => {
    const r = tryAct(
      state({
        step: WorkflowStep.DISCARD_TIP,
        hasTip: true,
        interactionPhase: 'acting',
        lockedTarget: { kind: 'trash' },
      }),
      curveFor(SOFT_PRESS_MS),
    );
    expect(r.nextState).toEqual({});
  });
});

// ─── advanceFromFinishing ───────────────────────────────────────────────

describe('advanceFromFinishing', () => {
  it('GET_TIP → DRAW_SAMPLE within a cycle', () => {
    const s = state({ step: WorkflowStep.GET_TIP, interactionPhase: 'finishing' });
    const r = advanceFromFinishing(s);
    expect(r.nextState.step).toBe(WorkflowStep.DRAW_SAMPLE);
    expect(r.nextState.interactionPhase).toBe('free');
  });

  it('DRAW_SAMPLE → LOAD_WELL within a cycle', () => {
    const r = advanceFromFinishing(state({ step: WorkflowStep.DRAW_SAMPLE, interactionPhase: 'finishing' }));
    expect(r.nextState.step).toBe(WorkflowStep.LOAD_WELL);
  });

  it('LOAD_WELL → DISCARD_TIP within a cycle', () => {
    const r = advanceFromFinishing(state({ step: WorkflowStep.LOAD_WELL, interactionPhase: 'finishing' }));
    expect(r.nextState.step).toBe(WorkflowStep.DISCARD_TIP);
  });

  it('DISCARD_TIP at activeStep<COUNT-1 → next cycle GET_TIP', () => {
    const r = advanceFromFinishing(
      state({ step: WorkflowStep.DISCARD_TIP, interactionPhase: 'finishing', activeStep: 1 }),
    );
    expect(r.nextState.step).toBe(WorkflowStep.GET_TIP);
    expect(r.nextState.activeStep).toBe(2);
    expect(eventCodes(r.events)).toEqual(['CYCLE_COMPLETE', 'STEP_ADVANCED']);
  });

  it('DISCARD_TIP at the last activeStep → RUN_GEL', () => {
    const r = advanceFromFinishing(
      state({ step: WorkflowStep.DISCARD_TIP, interactionPhase: 'finishing', activeStep: WORKFLOW.WELL_COUNT - 1 }),
    );
    expect(r.nextState.step).toBe(WorkflowStep.RUN_GEL);
    expect(eventCodes(r.events)).toEqual(['CYCLE_COMPLETE', 'RUN_READY']);
  });

  it('clears descentMs and tapCount on every cycle transition', () => {
    const r = advanceFromFinishing(
      state({
        step: WorkflowStep.LOAD_WELL,
        interactionPhase: 'finishing',
        descentMs: 850,
      }),
    );
    expect(r.nextState.descentMs).toBe(0);
    expect(r.nextState.tapCount).toBe(0);
  });

  it('is a no-op when failure is set (player must reset first)', () => {
    const r = advanceFromFinishing(
      state({ step: WorkflowStep.DRAW_SAMPLE, interactionPhase: 'finishing', failure: 'HARD_STOP_TO_DRAW' }),
    );
    expect(r.nextState).toEqual({});
  });

  it('is a no-op outside of finishing phase', () => {
    expect(advanceFromFinishing(state({ interactionPhase: 'free' })).nextState).toEqual({});
  });
});

// ─── tickRun ────────────────────────────────────────────────────────────

describe('tickRun', () => {
  const runState = state({ step: WorkflowStep.RUN_GEL });

  it('is a no-op while elapsed < RUN_DURATION_MS', () => {
    expect(tickRun(runState, 0).nextState).toEqual({});
    expect(tickRun(runState, RUN_DURATION_MS - 1).nextState).toEqual({});
  });

  it('advances to COMPLETE at elapsed === RUN_DURATION_MS', () => {
    const r = tickRun(runState, RUN_DURATION_MS);
    expect(r.nextState.step).toBe(WorkflowStep.COMPLETE);
    expect(eventCodes(r.events)).toEqual(['STEP_ADVANCED']);
  });

  it('still advances if called past the duration (idempotent)', () => {
    const r = tickRun(runState, RUN_DURATION_MS + 1_000);
    expect(r.nextState.step).toBe(WorkflowStep.COMPLETE);
  });

  it('is a no-op outside of RUN_GEL', () => {
    for (const step of [
      WorkflowStep.GET_TIP,
      WorkflowStep.DRAW_SAMPLE,
      WorkflowStep.LOAD_WELL,
      WorkflowStep.DISCARD_TIP,
      WorkflowStep.COMPLETE,
    ]) {
      expect(tickRun(state({ step }), RUN_DURATION_MS).nextState).toEqual({});
    }
  });
});

// ─── reset ──────────────────────────────────────────────────────────────

describe('reset', () => {
  it('returns the canonical initial state', () => {
    const init = reset();
    expect(init.step).toBe(WorkflowStep.GET_TIP);
    expect(init.activeStep).toBe(0);
    expect(init.hasTip).toBe(false);
    expect(init.liquidInTip).toBe(0);
    expect(init.dnaInWells).toEqual(Array(WORKFLOW.WELL_COUNT).fill(0));
    expect(init.usedTubes).toEqual([]);
    expect(init.warnings).toEqual([]);
    expect(init.failure).toBeNull();
    expect(init.interactionPhase).toBe('free');
    expect(init.lockedTarget).toBeNull();
    expect(init.descentMs).toBe(0);
    expect(init.tapCount).toBe(0);
  });

  it('clears a failure', () => {
    const dirty: RuleState = { ...initialRuleState(), failure: 'HARD_STOP_TO_DRAW' };
    const after = applyPatch(dirty, reset());
    expect(after.failure).toBeNull();
  });
});

// ─── Integration: happy-path multi-well ─────────────────────────────────

describe('integration — happy path through 4 wells', () => {
  function applyResult(s: RuleState, r: Result): RuleState {
    return applyPatch(s, r.nextState);
  }

  it('completes 4 cycles ending in RUN_GEL with no failure and no warnings', () => {
    let s: RuleState = initialRuleState();

    for (let i = 0; i < WORKFLOW.WELL_COUNT; i++) {
      const tube: HoverTarget = { kind: 'sample', index: i };
      const well: HoverTarget = { kind: 'well', index: i };

      // GET_TIP: lock → simulate camera commit (locked) → tap pickup → finish
      s = applyResult(s, tryLockOnto(s, { kind: 'tip-rack' }));
      s = applyPatch(s, { interactionPhase: 'locked' });
      s = applyResult(s, tryTapPickup(s, true));
      s = applyResult(s, advanceFromFinishing(s));
      expect(s.step).toBe(WorkflowStep.DRAW_SAMPLE);
      expect(s.hasTip).toBe(true);

      // DRAW_SAMPLE: lock → committing → locked → acting → finish
      s = applyResult(s, tryLockOnto(s, tube));
      s = applyPatch(s, { interactionPhase: 'acting' });
      s = applyResult(s, tryAct(s, curveFor(SOFT_PRESS_MS)));
      s = applyResult(s, advanceFromFinishing(s));
      expect(s.step).toBe(WorkflowStep.LOAD_WELL);
      expect(s.liquidInTip).toBe(1);

      // LOAD_WELL: lock → committing → descending → stop in good zone → locked → acting → finish
      s = applyResult(s, tryLockOnto(s, well));
      s = applyPatch(s, { interactionPhase: 'descending' });
      s = applyResult(s, tryStopDescent(s, GOOD_DESCENT_MS));
      expect(s.interactionPhase).toBe('locked');
      s = applyPatch(s, { interactionPhase: 'acting' });
      s = applyResult(s, tryAct(s, curveFor(HARD_PRESS_MS)));
      s = applyResult(s, advanceFromFinishing(s));
      expect(s.step).toBe(WorkflowStep.DISCARD_TIP);
      expect(s.dnaInWells[i]).toBe(1);

      // DISCARD_TIP: lock → locked → tap discard → finish
      s = applyResult(s, tryLockOnto(s, { kind: 'trash' }));
      s = applyPatch(s, { interactionPhase: 'locked' });
      s = applyResult(s, tryTapDiscard(s));
      s = applyResult(s, advanceFromFinishing(s));
      expect(s.hasTip).toBe(false);
    }

    expect(s.step).toBe(WorkflowStep.RUN_GEL);
    expect(s.failure).toBeNull();
    expect(s.warnings).toEqual([]);
    expect(s.dnaInWells).toEqual(Array(WORKFLOW.WELL_COUNT).fill(1));
  });
});

// ─── Safety invariants ──────────────────────────────────────────────────

describe('safety invariants', () => {
  it('INV-2: activeStep is monotone non-decreasing across rule applications', () => {
    let s: RuleState = initialRuleState();
    const seen: number[] = [s.activeStep];
    for (let i = 0; i < 2; i++) {
      s = applyPatch(s, tryLockOnto(s, { kind: 'tip-rack' }).nextState);
      s = applyPatch(s, { interactionPhase: 'locked' });
      s = applyPatch(s, tryTapPickup(s, true).nextState);
      s = applyPatch(s, advanceFromFinishing(s).nextState);
      seen.push(s.activeStep);

      s = applyPatch(s, tryLockOnto(s, { kind: 'sample', index: i }).nextState);
      s = applyPatch(s, { interactionPhase: 'acting' });
      s = applyPatch(s, tryAct(s, curveFor(SOFT_PRESS_MS)).nextState);
      s = applyPatch(s, advanceFromFinishing(s).nextState);
      seen.push(s.activeStep);

      s = applyPatch(s, tryLockOnto(s, { kind: 'well', index: i }).nextState);
      s = applyPatch(s, { interactionPhase: 'descending' });
      s = applyPatch(s, tryStopDescent(s, GOOD_DESCENT_MS).nextState);
      s = applyPatch(s, { interactionPhase: 'acting' });
      s = applyPatch(s, tryAct(s, curveFor(HARD_PRESS_MS)).nextState);
      s = applyPatch(s, advanceFromFinishing(s).nextState);
      seen.push(s.activeStep);

      s = applyPatch(s, tryLockOnto(s, { kind: 'trash' }).nextState);
      s = applyPatch(s, { interactionPhase: 'locked' });
      s = applyPatch(s, tryTapDiscard(s).nextState);
      s = applyPatch(s, advanceFromFinishing(s).nextState);
      seen.push(s.activeStep);
    }
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
    expect(seen[seen.length - 1]).toBe(2);
  });

  it('INV-3: reset() clears any failure', () => {
    const failed = applyPatch(initialRuleState(), {
      failure: 'HARD_STOP_TO_DRAW',
      interactionPhase: 'finishing',
      hasTip: true,
    });
    const recovered = applyPatch(failed, reset());
    expect(recovered.failure).toBeNull();
    expect(recovered.hasTip).toBe(false);
    expect(recovered.interactionPhase).toBe('free');
  });

  it('INV-4: warnings is append-only across rule applications (between resets)', () => {
    let s = initialRuleState();
    s = applyPatch(s, { step: WorkflowStep.DRAW_SAMPLE, hasTip: true });
    s = applyPatch(s, tryLockOnto(s, { kind: 'sample', index: 2 }).nextState);
    s = applyPatch(s, { interactionPhase: 'acting' });
    const r1 = tryAct(s, curveFor(SOFT_PRESS_MS));
    s = applyPatch(s, r1.nextState);
    expect(s.warnings.length).toBe(1);

    s = applyPatch(s, advanceFromFinishing(s).nextState);
    expect(s.warnings.length).toBe(1);
  });
});
