import { create } from 'zustand';
import { StreakStep } from './sim/types';
import type {
  InteractionPhase,
  StreakHoverTarget,
  StreakLockTarget,
} from './sim/types';
import { PATH, PLATE_ROTATION, POOL, STREAK_FIELD } from './sim/config';
import {
  applyContact,
  createField,
  seedPool,
  type StreakField,
} from './sim/streakField';
import { generateColonies, type Colony } from './sim/growth';
import {
  createStroke,
  pushPoint,
  segmentSteps,
  type Stroke,
} from './sim/path';
import { worldToAgarLocal } from './sim/transform';

export { StreakStep };

interface StreakState {
  // ─── Workflow + phase ─────────────────────────────────────────────────
  step: StreakStep;
  /** 'free' when the loop is up; 'acting' while held down and streaking. */
  interactionPhase: InteractionPhase;

  // ─── Tool state ───────────────────────────────────────────────────────
  hasLoop: boolean;
  lockedTarget: StreakLockTarget | null;

  // ─── Cursor + hover ───────────────────────────────────────────────────
  pointer: { x: number; z: number } | null;
  hoverTarget: StreakHoverTarget;

  // ─── Plate rotation ───────────────────────────────────────────────────
  /** Target plate rotation (radians); the dish damps toward it. */
  plateRotation: number;
  /** True while the dish animates to a new rotation (blocks lowering). */
  rotating: boolean;

  // ─── Streak field + strokes ───────────────────────────────────────────
  /** Agar-local bacterial density grid (mutated in place by the driver). */
  field: StreakField;
  /** Bacteria currently carried on the loop. */
  carriedLoad: number;
  /** Recorded strokes (agar-local), drawn as the visible marks. */
  strokes: Stroke[];

  // ─── Incubation + colonies ────────────────────────────────────────────
  /** Colonies grown from the field; frozen at incubation start ([] before). */
  colonies: Colony[];
  /** Wall-clock ms when incubation began; null when not incubating. */
  incubationStartedAt: number | null;

  // ─── Actions ──────────────────────────────────────────────────────────
  setStep: (step: StreakStep) => void;
  setInteractionPhase: (phase: InteractionPhase) => void;
  setHasLoop: (val: boolean) => void;
  setLockedTarget: (t: StreakLockTarget | null) => void;
  setPointer: (p: { x: number; z: number } | null) => void;
  setHoverTarget: (t: StreakHoverTarget) => void;
  /** Pick up the sterile loop and move into the streaking step. */
  pickUpLoop: () => void;
  /** Rotate the agar a quarter turn counter-clockwise. */
  rotatePlateCCW: () => void;
  /** Called by the dish when its rotation animation settles. */
  finishRotation: () => void;
  /** Lower the loop and begin a fresh stroke (gated; no-op otherwise). */
  lowerLoop: () => void;
  /** Record one contact point on the active stroke. */
  appendContact: (x: number, z: number, deposit: number) => void;
  setCarriedLoad: (v: number) => void;
  /** Lift the loop and finalize the active stroke. */
  raiseLoop: () => void;
  /** Grow colonies from the field and begin the incubation time-lapse. */
  startIncubation: () => void;
  /** Called by the incubation driver once the time-lapse finishes. */
  finishIncubation: () => void;
  reset: () => void;
}

type SeededState = Pick<
  StreakState,
  | 'step'
  | 'interactionPhase'
  | 'hasLoop'
  | 'lockedTarget'
  | 'pointer'
  | 'hoverTarget'
  | 'plateRotation'
  | 'rotating'
  | 'field'
  | 'carriedLoad'
  | 'strokes'
  | 'colonies'
  | 'incubationStartedAt'
>;

// Rebuilds fresh objects (a re-seeded field, empty stroke list) so reset()
// truly restores the starting plate rather than aliasing a mutated grid.
function makeInitial(): SeededState {
  const field = createField();
  seedPool(field, POOL.position[0], POOL.position[2], POOL.radius, STREAK_FIELD.POOL_DENSITY);
  return {
    step: StreakStep.GET_LOOP,
    interactionPhase: 'free',
    hasLoop: false,
    lockedTarget: null,
    pointer: null,
    hoverTarget: null,
    plateRotation: 0,
    rotating: false,
    field,
    carriedLoad: 0,
    strokes: [],
    colonies: [],
    incubationStartedAt: null,
  };
}

export const useStreakStore = create<StreakState>((set, get) => ({
  ...makeInitial(),

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

  rotatePlateCCW: () => {
    // Can't rotate mid-stroke; lift the loop first.
    if (get().interactionPhase === 'acting') return;
    set((s) => ({
      plateRotation: s.plateRotation + PLATE_ROTATION.STEP,
      rotating: true,
    }));
  },

  finishRotation: () => set({ rotating: false }),

  lowerLoop: () => {
    const s = get();
    if (
      s.step !== StreakStep.STREAK ||
      s.hoverTarget?.kind !== 'plate' ||
      s.rotating ||
      s.interactionPhase === 'acting'
    ) {
      return;
    }
    set((prev) => ({
      interactionPhase: 'acting',
      // Bound the list (drop oldest) so a long session can't grow it without
      // limit. The deposited bacteria live in `field`, not here — strokes are
      // only the visible marks — so dropping ancient marks loses nothing real.
      strokes: [...prev.strokes.slice(-(PATH.MAX_STROKES - 1)), createStroke()],
    }));
  },

  appendContact: (x, z, deposit) => {
    const { strokes } = get();
    const active = strokes[strokes.length - 1];
    if (!active) return;
    pushPoint(active, { x, z }, deposit, PATH.MIN_SPACING, PATH.MAX_POINTS_PER_STROKE);
  },

  setCarriedLoad: (carriedLoad) => set({ carriedLoad }),

  raiseLoop: () => {
    if (get().interactionPhase !== 'acting') return;
    set({ interactionPhase: 'free' });
  },

  startIncubation: () => {
    const s = get();
    if (s.step !== StreakStep.STREAK || s.interactionPhase === 'acting') return;
    set({
      step: StreakStep.INCUBATE,
      interactionPhase: 'free',
      colonies: generateColonies(s.field),
      incubationStartedAt:
        typeof performance !== 'undefined' ? performance.now() : Date.now(),
    });
  },

  finishIncubation: () => {
    if (get().step !== StreakStep.INCUBATE) return;
    set({ step: StreakStep.COMPLETE });
  },

  reset: () => set({ ...makeInitial() }),
}));

// Dev-only handles so the Playwright smoke test can read store state and
// drive a streak in world coordinates — sidestepping the perspective
// camera's projective screen→world mapping (and its one-frame lag), which
// makes pixel-precise targeting flaky in a headless harness. `__devStreak`
// runs the exact field/path/transform code the real contact driver uses.
// Both are stripped from production builds and skipped under the node test
// runner (no window).
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  const w = window as unknown as {
    __streakStore?: typeof useStreakStore;
    __devStreak?: (worldPts: { x: number; z: number }[]) => {
      carried: number;
      points: number;
      deposits: number[];
    };
  };
  w.__streakStore = useStreakStore;
  w.__devStreak = (worldPts) => {
    const s = useStreakStore.getState();
    if (!s.hasLoop) s.pickUpLoop();
    useStreakStore.setState((prev) => ({
      interactionPhase: 'acting',
      strokes: [
        ...prev.strokes.slice(-(PATH.MAX_STROKES - 1)),
        createStroke(),
      ],
    }));
    const st = useStreakStore.getState();
    const rot = st.plateRotation;
    let carried = st.carriedLoad;
    let prev = worldToAgarLocal(worldPts[0], rot);
    let leftover = 0;
    for (let i = 1; i < worldPts.length; i++) {
      const cur = worldToAgarLocal(worldPts[i], rot);
      const { points, leftover: rest } = segmentSteps(
        prev,
        cur,
        leftover,
        STREAK_FIELD.STEP_DIST,
      );
      leftover = rest;
      prev = cur;
      for (const p of points) {
        const r = applyContact(st.field, p.x, p.z, carried);
        carried = r.carried;
        if (r.deposited >= STREAK_FIELD.MARK_MIN_DEPOSIT) {
          st.appendContact(p.x, p.z, r.deposited);
        }
      }
    }
    st.setCarriedLoad(carried);
    useStreakStore.setState({ interactionPhase: 'free' });
    const active = useStreakStore.getState().strokes.slice(-1)[0];
    return {
      carried,
      points: active ? active.points.length : 0,
      deposits: active ? active.points.map((p) => p.deposit) : [],
    };
  };
}

export type { StreakState };
