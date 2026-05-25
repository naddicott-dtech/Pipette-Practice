import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { WorldPointRef } from '../../scene/usePointerWorld';
import { useStreakStore } from '../store';
import { applyContact } from '../sim/streakField';
import { segmentSteps } from '../sim/path';
import { worldToAgarLocal, type Vec2 } from '../sim/transform';
import { STREAK_FIELD } from '../sim/config';

interface DriverProps {
  pointerRef: WorldPointRef;
}

/**
 * Per-frame streak integration. While the loop is held down ('acting'),
 * convert the world pointer to agar-local space, walk the agar from the
 * previous contact point in fixed `STEP_DIST` increments, and at each step
 * exchange bacteria with the field (`applyContact`) and record a mark
 * (`appendContact`). Distance-based, so deposit is independent of frame
 * rate and mouse speed. Non-rendering; hover stays in the other driver.
 */
export function StreakContactDriver({ pointerRef }: DriverProps) {
  const prevLocal = useRef<Vec2 | null>(null);
  const leftover = useRef(0);
  const wasActing = useRef(false);

  useFrame(() => {
    const state = useStreakStore.getState();
    const acting = state.interactionPhase === 'acting';

    if (!acting) {
      if (wasActing.current) {
        prevLocal.current = null;
        leftover.current = 0;
        wasActing.current = false;
      }
      return;
    }

    const world = pointerRef.current;
    if (!world) return;
    const local = worldToAgarLocal(world, state.plateRotation);

    if (!wasActing.current) {
      // First frame of the stroke: anchor without depositing.
      prevLocal.current = local;
      leftover.current = 0;
      wasActing.current = true;
      return;
    }

    const prev = prevLocal.current!;
    const { points, leftover: rest } = segmentSteps(
      prev,
      local,
      leftover.current,
      STREAK_FIELD.STEP_DIST,
    );
    leftover.current = rest;
    prevLocal.current = local;

    if (points.length === 0) return;

    let carried = state.carriedLoad;
    for (const p of points) {
      const r = applyContact(state.field, p.x, p.z, carried);
      carried = r.carried;
      if (r.deposited >= STREAK_FIELD.MARK_MIN_DEPOSIT) {
        state.appendContact(p.x, p.z, r.deposited);
      }
    }
    state.setCarriedLoad(carried);
  });

  return null;
}
