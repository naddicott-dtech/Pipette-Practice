import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, selectRuleState, WorkflowStep } from './store';
import { WORKFLOW } from './sim/config';
import { initialRuleState, tryTapPickup } from './sim/rules';
import { startCurve, tickCurve } from './sim/plunger';
import type { RuleState } from './sim/types';

describe('Store — basic workflow + setters', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('starts at GET_TIP step with no tip and no liquid', () => {
    const state = useStore.getState();
    expect(state.step).toBe(WorkflowStep.GET_TIP);
    expect(state.hasTip).toBe(false);
    expect(state.liquidInTip).toBe(0);
  });

  it('can advance to DRAW_SAMPLE with a tip in hand', () => {
    useStore.getState().setHasTip(true);
    useStore.getState().setStep(WorkflowStep.DRAW_SAMPLE);

    const state = useStore.getState();
    expect(state.hasTip).toBe(true);
    expect(state.step).toBe(WorkflowStep.DRAW_SAMPLE);
  });

  it('records a failure code via setFailure', () => {
    useStore.getState().setFailure('HARD_STOP_TO_DRAW');
    expect(useStore.getState().failure).toBe('HARD_STOP_TO_DRAW');
  });

  it('tracks liquid volume', () => {
    useStore.getState().setLiquid(0.5);
    expect(useStore.getState().liquidInTip).toBe(0.5);
    useStore.getState().setLiquid(0);
    expect(useStore.getState().liquidInTip).toBe(0);
  });

  it('records DNA in wells (clamped at 1)', () => {
    useStore.getState().addDnaToWell(0, 0.8);
    expect(useStore.getState().dnaInWells[0]).toBe(0.8);
    useStore.getState().addDnaToWell(0, 0.5);
    expect(useStore.getState().dnaInWells[0]).toBe(1);
  });
});

describe('Store — RuleState fields', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('initial state matches initialRuleState() for the rules-layer fields', () => {
    const init = initialRuleState();
    const s = useStore.getState();
    expect(s.step).toBe(init.step);
    expect(s.activeStep).toBe(init.activeStep);
    expect(s.hasTip).toBe(init.hasTip);
    expect(s.liquidInTip).toBe(init.liquidInTip);
    expect(s.liquidSourceIndex).toBe(init.liquidSourceIndex);
    expect(s.usedTubes).toEqual(init.usedTubes);
    expect(s.warnings).toEqual(init.warnings);
    expect(s.failure).toBe(init.failure);
    expect(s.interactionPhase).toBe(init.interactionPhase);
    expect(s.lockedTarget).toBe(init.lockedTarget);
    expect(s.dnaInWells).toEqual(Array(WORKFLOW.WELL_COUNT).fill(0));
    expect(s.wellSources).toEqual(Array(WORKFLOW.WELL_COUNT).fill(null));
  });

  it('setActiveStep sets the active step', () => {
    useStore.getState().setActiveStep(2);
    expect(useStore.getState().activeStep).toBe(2);
  });

  it('setLiquidSourceIndex sets and clears', () => {
    useStore.getState().setLiquidSourceIndex(1);
    expect(useStore.getState().liquidSourceIndex).toBe(1);
    useStore.getState().setLiquidSourceIndex(null);
    expect(useStore.getState().liquidSourceIndex).toBeNull();
  });

  it('addUsedTube appends and dedupes', () => {
    useStore.getState().addUsedTube(0);
    useStore.getState().addUsedTube(1);
    useStore.getState().addUsedTube(0); // duplicate ignored
    expect(useStore.getState().usedTubes).toEqual([0, 1]);
  });

  it('addWarning appends', () => {
    useStore.getState().addWarning({ code: 'WRONG_TUBE', lane: 0 });
    useStore.getState().addWarning({ code: 'NO_FRESH_TIP', lane: 1 });
    expect(useStore.getState().warnings).toEqual([
      { code: 'WRONG_TUBE', lane: 0 },
      { code: 'NO_FRESH_TIP', lane: 1 },
    ]);
  });

  it('setInteractionPhase advances the phase', () => {
    useStore.getState().setInteractionPhase('committing');
    expect(useStore.getState().interactionPhase).toBe('committing');
  });

  it('setLockedTarget captures and clears the target', () => {
    useStore.getState().setLockedTarget({ kind: 'sample', index: 2 });
    expect(useStore.getState().lockedTarget).toEqual({ kind: 'sample', index: 2 });
    useStore.getState().setLockedTarget(null);
    expect(useStore.getState().lockedTarget).toBeNull();
  });

  it('setRunStartedAt sets and clears', () => {
    useStore.getState().setRunStartedAt(1234);
    expect(useStore.getState().runStartedAt).toBe(1234);
    useStore.getState().setRunStartedAt(null);
    expect(useStore.getState().runStartedAt).toBeNull();
  });

  it('plungerCurve starts as an empty curve and can be advanced', () => {
    const s0 = useStore.getState();
    expect(s0.plungerCurve.startMs).toBeNull();

    useStore.getState().setPlungerCurve(startCurve(0));
    const s1 = useStore.getState();
    expect(s1.plungerCurve.startMs).toBe(0);

    useStore.getState().setPlungerCurve(tickCurve(s1.plungerCurve, 600));
    expect(useStore.getState().plungerCurve.currentMs).toBe(600);
  });
});

describe('Store — reset', () => {
  it('reset wipes RuleState fields back to defaults', () => {
    const s = useStore.getState();
    s.setActiveStep(3);
    s.setLiquidSourceIndex(2);
    s.addUsedTube(0);
    s.addUsedTube(1);
    s.setFailure('NO_TIP');
    s.addWarning({ code: 'WRONG_TUBE', lane: 0 });
    s.setInteractionPhase('locked');
    s.setLockedTarget({ kind: 'tip-rack' });
    s.setRunStartedAt(9999);
    s.setPlungerCurve(startCurve(0));
    s.setDescentMs(500);
    s.setTapCount(2);

    s.reset();

    const after = useStore.getState();
    expect(after.activeStep).toBe(0);
    expect(after.liquidSourceIndex).toBeNull();
    expect(after.usedTubes).toEqual([]);
    expect(after.failure).toBeNull();
    expect(after.warnings).toEqual([]);
    expect(after.interactionPhase).toBe('free');
    expect(after.lockedTarget).toBeNull();
    expect(after.runStartedAt).toBeNull();
    expect(after.plungerCurve.startMs).toBeNull();
    expect(after.descentMs).toBe(0);
    expect(after.tapCount).toBe(0);
  });

  it('reset returns fresh array references (no shared state with prior collections)', () => {
    const s = useStore.getState();
    s.addDnaToWell(0, 0.5);
    s.addUsedTube(0);
    s.addWarning({ code: 'WRONG_TUBE', lane: 0 });
    // wellSources isn't directly mutated through a setter — gets
    // populated via applyRulePatch from resolveEject. Test that reset
    // restores it to all-nulls regardless.
    s.applyRulePatch({ wellSources: [0, 1, 2, 3] });

    const beforeWells = useStore.getState().dnaInWells;
    const beforeTubes = useStore.getState().usedTubes;
    const beforeWarnings = useStore.getState().warnings;
    const beforeSources = useStore.getState().wellSources;

    s.reset();
    expect(useStore.getState().wellSources).not.toBe(beforeSources);
    expect(useStore.getState().wellSources).toEqual([null, null, null, null]);

    expect(useStore.getState().dnaInWells).not.toBe(beforeWells);
    expect(useStore.getState().usedTubes).not.toBe(beforeTubes);
    expect(useStore.getState().warnings).not.toBe(beforeWarnings);
  });
});

describe('Store — applyRulePatch (rules.ts → store bridge)', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('applies non-failure RuleState fields 1:1', () => {
    useStore.getState().applyRulePatch({
      hasTip: true,
      activeStep: 1,
      interactionPhase: 'finishing',
      liquidInTip: 1,
    });
    const s = useStore.getState();
    expect(s.hasTip).toBe(true);
    expect(s.activeStep).toBe(1);
    expect(s.interactionPhase).toBe('finishing');
    expect(s.liquidInTip).toBe(1);
  });

  it('applies a failure code 1:1 (post-C3 unification)', () => {
    useStore.getState().applyRulePatch({
      failure: 'EMPTY_EJECT',
      interactionPhase: 'finishing',
    });
    const s = useStore.getState();
    expect(s.failure).toBe('EMPTY_EJECT');
    expect(s.interactionPhase).toBe('finishing');
  });

  it('clears failure when the patch sets it to null', () => {
    useStore.getState().setFailure('NO_TIP');
    useStore.getState().applyRulePatch({ failure: null });
    expect(useStore.getState().failure).toBeNull();
  });

  it('replaces array fields when the patch provides a new array', () => {
    useStore.getState().addUsedTube(0);
    useStore.getState().applyRulePatch({ usedTubes: [0, 1, 2] });
    expect(useStore.getState().usedTubes).toEqual([0, 1, 2]);
  });
});

describe('Store — selectRuleState', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('projects the store into a RuleState shape', () => {
    const projected: RuleState = selectRuleState(useStore.getState());
    expect(projected).toEqual(initialRuleState());
  });

  it('reflects mutations made through setters', () => {
    const s = useStore.getState();
    s.setStep(WorkflowStep.LOAD_WELL);
    s.setHasTip(true);
    s.setLiquid(1);
    s.setLiquidSourceIndex(0);
    s.addUsedTube(0);
    s.setActiveStep(0);
    s.setLockedTarget({ kind: 'well', index: 0 });
    s.setInteractionPhase('locked');

    const projected = selectRuleState(useStore.getState());
    expect(projected.step).toBe(WorkflowStep.LOAD_WELL);
    expect(projected.hasTip).toBe(true);
    expect(projected.liquidInTip).toBe(1);
    expect(projected.liquidSourceIndex).toBe(0);
    expect(projected.usedTubes).toEqual([0]);
    expect(projected.lockedTarget).toEqual({ kind: 'well', index: 0 });
    expect(projected.interactionPhase).toBe('locked');
  });
});

describe('Store — round-trip rule application', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('a rule patch can be applied and re-projected to RuleState', () => {
    const s = useStore.getState();
    s.setStep(WorkflowStep.GET_TIP);
    s.setLockedTarget({ kind: 'tip-rack' });
    s.setInteractionPhase('locked');

    const result = tryTapPickup(selectRuleState(useStore.getState()), true);
    useStore.getState().applyRulePatch(result.nextState);

    const after = selectRuleState(useStore.getState());
    expect(after.hasTip).toBe(true);
    expect(after.interactionPhase).toBe('finishing');
  });
});
