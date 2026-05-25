import { create } from 'zustand';
import { StreakStep } from './sim/types';
import type {
  InteractionPhase,
  StreakHoverTarget,
  StreakLockTarget,
} from './sim/types';

export { StreakStep };

interface StreakState {
  // ─── Workflow + phase ─────────────────────────────────────────────────
  step: StreakStep;
  /** Inner interaction phase (Slice 1 stays 'free'; Slice 2 adds lowering). */
  interactionPhase: InteractionPhase;

  // ─── Tool state ───────────────────────────────────────────────────────
  hasLoop: boolean;
  lockedTarget: StreakLockTarget | null;

  // ─── Cursor + hover ───────────────────────────────────────────────────
  pointer: { x: number; z: number } | null;
  hoverTarget: StreakHoverTarget;

  // ─── Actions ──────────────────────────────────────────────────────────
  setStep: (step: StreakStep) => void;
  setInteractionPhase: (phase: InteractionPhase) => void;
  setHasLoop: (val: boolean) => void;
  setLockedTarget: (t: StreakLockTarget | null) => void;
  setPointer: (p: { x: number; z: number } | null) => void;
  setHoverTarget: (t: StreakHoverTarget) => void;
  /** Pick up the sterile loop and move into the streaking step. */
  pickUpLoop: () => void;
  reset: () => void;
}

const INITIAL: Pick<
  StreakState,
  | 'step'
  | 'interactionPhase'
  | 'hasLoop'
  | 'lockedTarget'
  | 'pointer'
  | 'hoverTarget'
> = {
  step: StreakStep.GET_LOOP,
  interactionPhase: 'free',
  hasLoop: false,
  lockedTarget: null,
  pointer: null,
  hoverTarget: null,
};

export const useStreakStore = create<StreakState>((set) => ({
  ...INITIAL,

  setStep: (step) => set({ step }),
  setInteractionPhase: (interactionPhase) => set({ interactionPhase }),
  setHasLoop: (hasLoop) => set({ hasLoop }),
  setLockedTarget: (lockedTarget) => set({ lockedTarget }),
  setPointer: (pointer) => set({ pointer }),
  setHoverTarget: (hoverTarget) => set({ hoverTarget }),
  pickUpLoop: () =>
    set({
      hasLoop: true,
      step: StreakStep.STREAK,
      interactionPhase: 'free',
      lockedTarget: null,
    }),
  reset: () => set({ ...INITIAL }),
}));

// Dev-only handle so the Playwright smoke test can read store state
// without a screen-space projection. Stripped from production builds and
// skipped under the node-based test runner (no window).
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as unknown as { __streakStore?: typeof useStreakStore }).__streakStore =
    useStreakStore;
}

export type { StreakState };
