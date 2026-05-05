import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, selectRuleState, WorkflowStep, FailureMode } from './store';
import { WORKFLOW } from './sim/config';
import { initialRuleState, tryAct } from './sim/rules';
import { startCurve, tickCurve } from './sim/plunger';
import type { RuleState } from './sim/types';

describe('Micropipette Simulation Logic — legacy', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('should start at GET_TIP step', () => {
    const state = useStore.getState();
    expect(state.step).toBe(WorkflowStep.GET_TIP);
    expect(state.hasTip).toBe(false);
  });

  it('should pick up a tip and progress to intake', () => {
    useStore.getState().setHasTip(true);
    useStore.getState().setStep(WorkflowStep.INTAKE_SAMPLE);

    const state = useStore.getState();
    expect(state.hasTip).toBe(true);
    expect(state.step).toBe(WorkflowStep.INTAKE_SAMPLE);
  });

  it('should trigger puncture failure (legacy)', () => {
    useStore.getState().setFailure(FailureMode.PUNCTURE);
    const state = useStore.getState();
    expect(state.failure).toBe(FailureMode.PUNCTURE);
  });

  it('should track liquid volume correctly', () => {
    useStore.getState().setLiquid(0.5);
    expect(useStore.getState().liquidInTip).toBe(0.5);

    useStore.getState().setLiquid(0);
    expect(useStore.getState().liquidInTip).toBe(0);
  });

  it('should record DNA in wells', () => {
    useStore.getState().addDnaToWell(0, 0.8);
    expect(useStore.getState().dnaInWells[0]).toBe(0.8);
  });

  it('should track lowering state', () => {
    expect(useStore.getState().isLowered).toBe(false);
    useStore.getState().setIsLowered(true);
    expect(useStore.getState().isLowered).toBe(true);
  });

  it('should track proximity states', () => {
    expect(useStore.getState().isNearSample).toBe(false);
    useStore.getState().setIsNearSample(true);
    expect(useStore.getState().isNearSample).toBe(true);

    expect(useStore.getState().isNearTips).toBe(false);
    useStore.getState().setIsNearTips(true);
    expect(useStore.getState().isNearTips).toBe(true);
  });

  it('should reset plunger to 0 when resetting or lowering (conceptual)', () => {
    useStore.getState().setPlunger(0.5);
    useStore.getState().reset();
    expect(useStore.getState().plungerPos).toBe(0);
  });
});

describe('Chunk C2 — new RuleState fields', () => {
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
    expect(s.ruleFailure).toBe(init.failure);
    expect(s.interactionPhase).toBe(init.interactionPhase);
    expect(s.lockedTarget).toBe(init.lockedTarget);
    expect(s.dnaInWells).toEqual(Array(WORKFLOW.WELL_COUNT).fill(0));
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

  it('setRuleFailure sets the new failure code (separate from legacy)', () => {
    useStore.getState().setRuleFailure('HARD_STOP_TO_DRAW');
    const s = useStore.getState();
    expect(s.ruleFailure).toBe('HARD_STOP_TO_DRAW');
    // Legacy failure untouched.
    expect(s.failure).toBeNull();
  });

  it('legacy and rule failures are independent fields', () => {
    useStore.getState().setFailure(FailureMode.PUNCTURE);
    useStore.getState().setRuleFailure('HARD_STOP_TO_DRAW');
    const s = useStore.getState();
    expect(s.failure).toBe(FailureMode.PUNCTURE);
    expect(s.ruleFailure).toBe('HARD_STOP_TO_DRAW');
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

describe('Chunk C2 — reset clears all new fields', () => {
  it('reset wipes new RuleState fields back to defaults', () => {
    const s = useStore.getState();
    s.setActiveStep(3);
    s.setLiquidSourceIndex(2);
    s.addUsedTube(0);
    s.addUsedTube(1);
    s.setRuleFailure('NO_TIP');
    s.addWarning({ code: 'WRONG_TUBE', lane: 0 });
    s.setInteractionPhase('locked');
    s.setLockedTarget({ kind: 'tip-rack' });
    s.setRunStartedAt(9999);
    s.setPlungerCurve(startCurve(0));

    s.reset();

    const after = useStore.getState();
    expect(after.activeStep).toBe(0);
    expect(after.liquidSourceIndex).toBeNull();
    expect(after.usedTubes).toEqual([]);
    expect(after.ruleFailure).toBeNull();
    expect(after.warnings).toEqual([]);
    expect(after.interactionPhase).toBe('free');
    expect(after.lockedTarget).toBeNull();
    expect(after.runStartedAt).toBeNull();
    expect(after.plungerCurve.startMs).toBeNull();
  });

  it('reset returns fresh array references (no shared state with prior collections)', () => {
    const s = useStore.getState();
    s.addDnaToWell(0, 0.5);
    s.addUsedTube(0);
    s.addWarning({ code: 'WRONG_TUBE', lane: 0 });

    const beforeWells = useStore.getState().dnaInWells;
    const beforeTubes = useStore.getState().usedTubes;
    const beforeWarnings = useStore.getState().warnings;

    s.reset();

    expect(useStore.getState().dnaInWells).not.toBe(beforeWells);
    expect(useStore.getState().usedTubes).not.toBe(beforeTubes);
    expect(useStore.getState().warnings).not.toBe(beforeWarnings);
  });
});

describe('Chunk C2 — applyRulePatch (rules.ts → store bridge)', () => {
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

  it('translates RuleState.failure into store.ruleFailure', () => {
    useStore.getState().applyRulePatch({
      failure: 'EMPTY_EJECT',
      interactionPhase: 'finishing',
    });
    const s = useStore.getState();
    expect(s.ruleFailure).toBe('EMPTY_EJECT');
    expect(s.interactionPhase).toBe('finishing');
    // Legacy failure must NOT be touched by rules.
    expect(s.failure).toBeNull();
  });

  it('clears ruleFailure when the patch sets failure to null', () => {
    useStore.getState().setRuleFailure('NO_TIP');
    useStore.getState().applyRulePatch({ failure: null });
    expect(useStore.getState().ruleFailure).toBeNull();
  });

  it('does not touch ruleFailure when the patch omits failure', () => {
    useStore.getState().setRuleFailure('NO_TIP');
    useStore.getState().applyRulePatch({ activeStep: 2 });
    expect(useStore.getState().ruleFailure).toBe('NO_TIP');
  });

  it('replaces array fields when the patch provides a new array', () => {
    useStore.getState().addUsedTube(0);
    useStore.getState().applyRulePatch({ usedTubes: [0, 1, 2] });
    expect(useStore.getState().usedTubes).toEqual([0, 1, 2]);
  });
});

describe('Chunk C2 — selectRuleState', () => {
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

  it('maps store.ruleFailure (not store.failure) to RuleState.failure', () => {
    useStore.getState().setFailure(FailureMode.PUNCTURE);
    useStore.getState().setRuleFailure('NO_TIP');
    const projected = selectRuleState(useStore.getState());
    expect(projected.failure).toBe('NO_TIP');
    // PUNCTURE is a legacy concept; rules never see it.
  });
});

describe('Chunk C2 — round-trip rule application through the store', () => {
  beforeEach(() => {
    useStore.getState().reset();
  });

  it('a rule patch can be applied and re-projected to RuleState', () => {
    const s = useStore.getState();
    s.setStep(WorkflowStep.GET_TIP);
    s.setLockedTarget({ kind: 'tip-rack' });
    s.setInteractionPhase('acting');

    const curve = tickCurve(startCurve(0), 600);
    const result = tryAct(selectRuleState(useStore.getState()), curve);
    useStore.getState().applyRulePatch(result.nextState);

    const after = selectRuleState(useStore.getState());
    expect(after.hasTip).toBe(true);
    expect(after.interactionPhase).toBe('finishing');
  });
});
