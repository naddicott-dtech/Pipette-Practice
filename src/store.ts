import { create } from 'zustand';
import { WORKFLOW } from './sim/config';
import {
  WorkflowStep,
  type FailureCode,
  type HoverTarget,
  type InteractionPhase,
  type LockTarget,
  type RuleState,
  type WarningRecord,
} from './sim/types';
import { emptyCurve, type PlungerCurve } from './sim/plunger';

// Re-exported so existing consumers can `import { WorkflowStep } from '../store'`.
export { WorkflowStep };

interface SimulationState {
  // ─── Workflow + active step ───────────────────────────────────────────
  step: WorkflowStep;
  /** 0..WELL_COUNT-1; the tube/well pair the player is on. */
  activeStep: number;

  // ─── Pipette state ────────────────────────────────────────────────────
  liquidInTip: number; // 0..1
  hasTip: boolean;
  /** Sample tube the current liquid was drawn from. */
  liquidSourceIndex: number | null;
  /** Tubes the player has already drawn from (for NO_FRESH_TIP). */
  usedTubes: number[];

  // ─── Gel + run ────────────────────────────────────────────────────────
  isBoxOn: boolean;
  dnaInWells: number[];
  /** Wall-clock ms when RUN_GEL began; null when not running. */
  runStartedAt: number | null;

  // ─── Failures + warnings ──────────────────────────────────────────────
  /** Single failure code from the rules layer; clears via `reset()`. */
  failure: FailureCode | null;
  /** Per-lane warnings; surface in the run debrief (C6). Append-only between resets. */
  warnings: WarningRecord[];

  // ─── Lock-and-act phase ───────────────────────────────────────────────
  interactionPhase: InteractionPhase;
  /** Target captured at lock time, held through finishing. */
  lockedTarget: LockTarget | null;
  /** In-flight plunger press. */
  plungerCurve: PlungerCurve;
  /** ms elapsed in the LOAD_WELL `descending` sub-phase. */
  descentMs: number;
  /** Tap counter for tap-driven actions (GET_TIP, DISCARD_TIP). */
  tapCount: number;

  // ─── Cursor + hover ───────────────────────────────────────────────────
  pointer: { x: number; z: number } | null;
  hoverTarget: HoverTarget;
  /**
   * @deprecated Mirrored from `hoverTarget` by InteractionDriver.
   * Consumed by `GelBox` until C4 replaces it with `activeStep` plus a
   * live-hover ring.
   */
  activeWellIndex: number | null;

  // ─── Actions ──────────────────────────────────────────────────────────
  setStep: (step: WorkflowStep) => void;
  setActiveStep: (n: number) => void;
  setHasTip: (val: boolean) => void;
  setLiquid: (val: number) => void;
  setLiquidSourceIndex: (n: number | null) => void;
  addUsedTube: (n: number) => void;
  setBoxOn: (val: boolean) => void;
  setRunStartedAt: (ms: number | null) => void;
  addDnaToWell: (index: number, amount: number) => void;
  setFailure: (code: FailureCode | null) => void;
  addWarning: (w: WarningRecord) => void;
  setInteractionPhase: (phase: InteractionPhase) => void;
  setLockedTarget: (t: LockTarget | null) => void;
  setPlungerCurve: (curve: PlungerCurve) => void;
  setDescentMs: (ms: number) => void;
  setTapCount: (n: number) => void;
  /**
   * Apply a `Result.nextState` patch from a rules.ts function. RuleState
   * keys map 1:1 to store keys.
   */
  applyRulePatch: (patch: Partial<RuleState>) => void;
  setActiveWellIndex: (index: number | null) => void;
  setPointer: (p: { x: number; z: number } | null) => void;
  setHoverTarget: (t: HoverTarget) => void;
  reset: () => void;
}

// Module-level initial state. Primitive values are shared safely; arrays
// (`dnaInWells`, `usedTubes`, `warnings`, `plungerCurve`) are reference
// types — `reset()` and any future reset path MUST rebuild them via
// `Array(...)` / `emptyCurve()` to avoid leaking shared references that
// earlier callers might mutate.
const INITIAL: Pick<
  SimulationState,
  | 'step'
  | 'activeStep'
  | 'liquidInTip'
  | 'hasTip'
  | 'liquidSourceIndex'
  | 'usedTubes'
  | 'isBoxOn'
  | 'dnaInWells'
  | 'runStartedAt'
  | 'failure'
  | 'warnings'
  | 'interactionPhase'
  | 'lockedTarget'
  | 'plungerCurve'
  | 'descentMs'
  | 'tapCount'
  | 'activeWellIndex'
  | 'pointer'
  | 'hoverTarget'
> = {
  step: WorkflowStep.GET_TIP,
  activeStep: 0,
  liquidInTip: 0,
  hasTip: false,
  liquidSourceIndex: null,
  usedTubes: [],
  isBoxOn: false,
  dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0),
  runStartedAt: null,
  failure: null,
  warnings: [],
  interactionPhase: 'free',
  lockedTarget: null,
  plungerCurve: emptyCurve(),
  descentMs: 0,
  tapCount: 0,
  activeWellIndex: null,
  pointer: null,
  hoverTarget: null,
};

export const useStore = create<SimulationState>((set) => ({
  ...INITIAL,

  setStep: (step) => set({ step }),
  setActiveStep: (activeStep) => set({ activeStep }),
  setHasTip: (hasTip) => set({ hasTip }),
  setLiquid: (liquidInTip) => set({ liquidInTip }),
  setLiquidSourceIndex: (liquidSourceIndex) => set({ liquidSourceIndex }),
  addUsedTube: (n) =>
    set((s) => (s.usedTubes.includes(n) ? {} : { usedTubes: [...s.usedTubes, n] })),
  setBoxOn: (isBoxOn) => set({ isBoxOn }),
  setRunStartedAt: (runStartedAt) => set({ runStartedAt }),
  addDnaToWell: (index, amount) =>
    set((state) => {
      const next = [...state.dnaInWells];
      next[index] = Math.min(1, next[index] + amount);
      return { dnaInWells: next };
    }),
  setFailure: (failure) => set({ failure }),
  addWarning: (w) => set((s) => ({ warnings: [...s.warnings, w] })),
  setInteractionPhase: (interactionPhase) => set({ interactionPhase }),
  setLockedTarget: (lockedTarget) => set({ lockedTarget }),
  setPlungerCurve: (plungerCurve) => set({ plungerCurve }),
  setDescentMs: (descentMs) => set({ descentMs }),
  setTapCount: (tapCount) => set({ tapCount }),
  applyRulePatch: (patch) => set(patch),
  setActiveWellIndex: (activeWellIndex) => set({ activeWellIndex }),
  setPointer: (pointer) => set({ pointer }),
  setHoverTarget: (hoverTarget) => set({ hoverTarget }),
  reset: () =>
    set({
      ...INITIAL,
      dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0),
      usedTubes: [],
      warnings: [],
      plungerCurve: emptyCurve(),
    }),
}));

/**
 * Project the store into a `RuleState` snapshot for rule calls. After
 * C3 the projection is a 1:1 read — every key on RuleState exists on
 * SimulationState with matching type.
 */
export function selectRuleState(state: SimulationState): RuleState {
  return {
    step: state.step,
    activeStep: state.activeStep,
    hasTip: state.hasTip,
    liquidInTip: state.liquidInTip,
    liquidSourceIndex: state.liquidSourceIndex,
    dnaInWells: state.dnaInWells,
    usedTubes: state.usedTubes,
    warnings: state.warnings,
    failure: state.failure,
    interactionPhase: state.interactionPhase,
    lockedTarget: state.lockedTarget,
    descentMs: state.descentMs,
    tapCount: state.tapCount,
  };
}

export type { SimulationState };
