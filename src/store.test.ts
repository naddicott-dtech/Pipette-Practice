import { describe, it, expect, beforeEach } from 'vitest';
import { useStore, WorkflowStep, FailureMode } from './store';

describe('Micropipette Simulation Logic', () => {
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

  it('should trigger puncture failure', () => {
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
