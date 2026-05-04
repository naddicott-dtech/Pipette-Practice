import { create } from 'zustand';
import { WORKFLOW } from './sim/config';

export enum WorkflowStep {
  GET_TIP = 'GET_TIP',
  INTAKE_SAMPLE = 'INTAKE_SAMPLE',
  LOAD_WELL = 'LOAD_WELL',
  RUN_GEL = 'RUN_GEL',
  COMPLETE = 'COMPLETE'
}

export enum FailureMode {
  PUNCTURE = 'PUNCTURE',
  OVERFLOW = 'OVERFLOW',
  EMPTY_EJECT = 'EMPTY_EJECT',
  NO_TIP = 'NO_TIP'
}

interface SimulationState {
  step: WorkflowStep;
  plungerPos: number; // 0 to 1
  liquidInTip: number; // 0 to 1
  hasTip: boolean;
  isBoxOn: boolean;
  failure: FailureMode | null;
  dnaInWells: number[]; // amount in each well (success storage)
  activeWellIndex: number | null; // well pipette is currently over
  isLowered: boolean;
  isNearSample: boolean;
  isNearTips: boolean;
  
  // Actions
  setStep: (step: WorkflowStep) => void;
  setPlunger: (pos: number) => void;
  setHasTip: (val: boolean) => void;
  setLiquid: (val: number) => void;
  setFailure: (fail: FailureMode | null) => void;
  setBoxOn: (val: boolean) => void;
  addDnaToWell: (index: number, amount: number) => void;
  setActiveWellIndex: (index: number | null) => void;
  setIsLowered: (val: boolean) => void;
  setIsNearSample: (val: boolean) => void;
  setIsNearTips: (val: boolean) => void;
  reset: () => void;
}

export const useStore = create<SimulationState>((set) => ({
  step: WorkflowStep.GET_TIP,
  plungerPos: 0,
  liquidInTip: 0,
  hasTip: false,
  isBoxOn: false,
  failure: null,
  dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0),
  activeWellIndex: null,
  isLowered: false,
  isNearSample: false,
  isNearTips: false,

  setStep: (step) => set({ step }),
  setPlunger: (plungerPos) => set({ plungerPos }),
  setHasTip: (hasTip) => set({ hasTip }),
  setLiquid: (liquidInTip) => set({ liquidInTip }),
  setFailure: (failure) => set({ failure }),
  setBoxOn: (isBoxOn) => set({ isBoxOn }),
  addDnaToWell: (index, amount) => set((state) => {
    const next = [...state.dnaInWells];
    next[index] = Math.min(1, next[index] + amount);
    return { dnaInWells: next };
  }),
  setActiveWellIndex: (activeWellIndex) => set({ activeWellIndex }),
  setIsLowered: (isLowered) => set({ isLowered }),
  setIsNearSample: (isNearSample) => set({ isNearSample }),
  setIsNearTips: (isNearTips) => set({ isNearTips }),
  reset: () => set({
    step: WorkflowStep.GET_TIP,
    plungerPos: 0,
    liquidInTip: 0,
    hasTip: false,
    isBoxOn: false,
    failure: null,
    dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0),
    activeWellIndex: null,
    isLowered: false,
    isNearSample: false,
    isNearTips: false,
  }),
}));
