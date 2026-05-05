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

// WorkflowStep is canonically defined in sim/types.ts (Chunk C). Re-exported
// here so existing component imports (`import { WorkflowStep } from '../store'`)
// continue to work through C1/C2. C3 may migrate consumers to import directly
// from sim/types.
export { WorkflowStep };

/**
 * Legacy failure enum, kept until C3 rewrites the failure modal. The new
 * rules layer uses the `FailureCode` string union from sim/types — see
 * `state.ruleFailure` below for the field the lock-and-act driver writes.
 *
 * `state.failure` (this enum) is what the current legacy modal in
 * UIOverlay.tsx reads. C3 deletes this enum, removes `state.failure`, and
 * renames `ruleFailure` to `failure`.
 */
export enum FailureMode {
  PUNCTURE = 'PUNCTURE',
  OVERFLOW = 'OVERFLOW',
  EMPTY_EJECT = 'EMPTY_EJECT',
  NO_TIP = 'NO_TIP',
}

interface SimulationState {
  // ─── Workflow + active step ───────────────────────────────────────────
  step: WorkflowStep;
  /** 0..WELL_COUNT-1; the tube/well pair the player is on. New in C2. */
  activeStep: number;

  // ─── Pipette state ────────────────────────────────────────────────────
  plungerPos: number; // 0..1; legacy — driven by the rotated slider
  liquidInTip: number; // 0..1
  hasTip: boolean;
  /** Sample tube the current liquid was drawn from. New in C2. */
  liquidSourceIndex: number | null;
  /** Tubes the player has already drawn from (for NO_FRESH_TIP). New in C2. */
  usedTubes: number[];

  // ─── Gel + run ────────────────────────────────────────────────────────
  isBoxOn: boolean;
  dnaInWells: number[];
  /** Wall-clock ms when RUN_GEL began; null when not running. New in C2. */
  runStartedAt: number | null;

  // ─── Failures + warnings ──────────────────────────────────────────────
  /** Legacy failure (PUNCTURE/OVERFLOW/EMPTY_EJECT/NO_TIP). Removed in C3. */
  failure: FailureMode | null;
  /** New rules-layer failure (NO_TIP/HARD_STOP_TO_DRAW/EMPTY_EJECT). New in C2. */
  ruleFailure: FailureCode | null;
  /** Per-lane warnings; surface in the run debrief. Append-only between resets. New in C2. */
  warnings: WarningRecord[];

  // ─── Lock-and-act phase ───────────────────────────────────────────────
  /** Inner-loop interaction phase. New in C2; consumed by the C3 driver. */
  interactionPhase: InteractionPhase;
  /** Target captured at lock time, held through finishing. New in C2. */
  lockedTarget: LockTarget | null;
  /** In-flight plunger press. New in C2. */
  plungerCurve: PlungerCurve;

  // ─── Legacy hover/lower state (consumed by current InteractionDriver) ─
  /** @deprecated mirrored from `lockedTarget` in C3; removed in C4. */
  activeWellIndex: number | null;
  /** @deprecated removed in C3 once the new driver replaces hold-to-lower. */
  isLowered: boolean;
  /** @deprecated removed in C3. */
  isNearSample: boolean;
  /** @deprecated removed in C3. */
  isNearTips: boolean;

  // ─── Cursor / Chunk B additions ───────────────────────────────────────
  pointer: { x: number; z: number } | null;
  hoverTarget: HoverTarget;
  /** @deprecated removed in C3 with the hold-to-lower mechanic. */
  loweredDepth: number;

  // ─── Actions ──────────────────────────────────────────────────────────
  setStep: (step: WorkflowStep) => void;
  setActiveStep: (n: number) => void;
  setPlunger: (pos: number) => void;
  setHasTip: (val: boolean) => void;
  setLiquid: (val: number) => void;
  setLiquidSourceIndex: (n: number | null) => void;
  addUsedTube: (n: number) => void;
  setBoxOn: (val: boolean) => void;
  setRunStartedAt: (ms: number | null) => void;
  addDnaToWell: (index: number, amount: number) => void;
  setFailure: (fail: FailureMode | null) => void;
  setRuleFailure: (code: FailureCode | null) => void;
  addWarning: (w: WarningRecord) => void;
  setInteractionPhase: (phase: InteractionPhase) => void;
  setLockedTarget: (t: LockTarget | null) => void;
  setPlungerCurve: (curve: PlungerCurve) => void;
  /**
   * Apply a `Result.nextState` patch from a rules.ts function. Translates
   * the rules-layer `failure: FailureCode | null` field into the store's
   * `ruleFailure` field (so the legacy `failure` is untouched). Other
   * RuleState fields map 1:1.
   */
  applyRulePatch: (patch: Partial<RuleState>) => void;
  setActiveWellIndex: (index: number | null) => void;
  setIsLowered: (val: boolean) => void;
  setIsNearSample: (val: boolean) => void;
  setIsNearTips: (val: boolean) => void;
  setPointer: (p: { x: number; z: number } | null) => void;
  setHoverTarget: (t: HoverTarget) => void;
  setLoweredDepth: (d: number) => void;
  reset: () => void;
}

// Module-level initial-state record. Primitives are shared safely; arrays
// (`dnaInWells`, `usedTubes`, `warnings`, `plungerCurve.peakDepth-bearing
// curve struct) are reference-shared from this object — `reset()` and any
// future reset path MUST rebuild them via `Array(...)`/`emptyCurve()` to
// avoid leaking shared references that older callers might mutate.
const INITIAL: Pick<
  SimulationState,
  | 'step'
  | 'activeStep'
  | 'plungerPos'
  | 'liquidInTip'
  | 'hasTip'
  | 'liquidSourceIndex'
  | 'usedTubes'
  | 'isBoxOn'
  | 'dnaInWells'
  | 'runStartedAt'
  | 'failure'
  | 'ruleFailure'
  | 'warnings'
  | 'interactionPhase'
  | 'lockedTarget'
  | 'plungerCurve'
  | 'activeWellIndex'
  | 'isLowered'
  | 'isNearSample'
  | 'isNearTips'
  | 'pointer'
  | 'hoverTarget'
  | 'loweredDepth'
> = {
  step: WorkflowStep.GET_TIP,
  activeStep: 0,
  plungerPos: 0,
  liquidInTip: 0,
  hasTip: false,
  liquidSourceIndex: null,
  usedTubes: [],
  isBoxOn: false,
  dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0),
  runStartedAt: null,
  failure: null,
  ruleFailure: null,
  warnings: [],
  interactionPhase: 'free',
  lockedTarget: null,
  plungerCurve: emptyCurve(),
  activeWellIndex: null,
  isLowered: false,
  isNearSample: false,
  isNearTips: false,
  pointer: null,
  hoverTarget: null,
  loweredDepth: 0,
};

export const useStore = create<SimulationState>((set) => ({
  ...INITIAL,

  setStep: (step) => set({ step }),
  setActiveStep: (activeStep) => set({ activeStep }),
  setPlunger: (plungerPos) => set({ plungerPos }),
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
  setRuleFailure: (ruleFailure) => set({ ruleFailure }),
  addWarning: (w) => set((s) => ({ warnings: [...s.warnings, w] })),
  setInteractionPhase: (interactionPhase) => set({ interactionPhase }),
  setLockedTarget: (lockedTarget) => set({ lockedTarget }),
  setPlungerCurve: (plungerCurve) => set({ plungerCurve }),
  applyRulePatch: (patch) =>
    set((state) => {
      // Translate rules' `failure: FailureCode | null` → store's `ruleFailure`.
      // Other RuleState keys map 1:1.
      const { failure, ...rest } = patch;
      const update: Partial<SimulationState> = { ...rest };
      if (failure !== undefined) {
        update.ruleFailure = failure;
      }
      return update;
    }),
  setActiveWellIndex: (activeWellIndex) => set({ activeWellIndex }),
  setIsLowered: (isLowered) => set({ isLowered }),
  setIsNearSample: (isNearSample) => set({ isNearSample }),
  setIsNearTips: (isNearTips) => set({ isNearTips }),
  setPointer: (pointer) => set({ pointer }),
  setHoverTarget: (hoverTarget) => set({ hoverTarget }),
  setLoweredDepth: (loweredDepth) => set({ loweredDepth }),
  reset: () =>
    set({
      ...INITIAL,
      // Defensive: rebuild collections so `reset()` doesn't return shared
      // references that earlier callers might still hold.
      dnaInWells: Array(WORKFLOW.WELL_COUNT).fill(0),
      usedTubes: [],
      warnings: [],
      plungerCurve: emptyCurve(),
    }),
}));

/**
 * Project the store into a `RuleState` snapshot. Used by the C3 driver
 * when calling pure rule functions from sim/rules.ts. The store's
 * `ruleFailure` field maps to RuleState's `failure` (rules don't see
 * the legacy `failure` enum).
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
    failure: state.ruleFailure,
    interactionPhase: state.interactionPhase,
    lockedTarget: state.lockedTarget,
  };
}

export type { SimulationState };
