import { useFrame } from '@react-three/fiber';
import type { WorldPointRef } from '../../scene/usePointerWorld';
import { useStreakStore } from '../store';
import { findStreakHover } from '../sim/hover';
import { STREAK_TARGETS } from '../sim/targets';
import type { StreakHoverTarget } from '../sim/types';

interface DriverProps {
  pointerRef: WorldPointRef;
}

/**
 * Per-frame hover detection: read the world pointer, compute the streak
 * hover target via the pure findStreakHover, and mirror both to the
 * store only on actual change (so we don't re-render subscribers every
 * frame). Mirrors the pipette sim's InteractionDriver.
 */
export function StreakInteractionDriver({ pointerRef }: DriverProps) {
  useFrame(() => {
    const state = useStreakStore.getState();

    const point = pointerRef.current;
    if (state.pointer !== point) state.setPointer(point);

    const hover = point ? findStreakHover(point, STREAK_TARGETS) : null;
    if (!hoversEqual(state.hoverTarget, hover)) {
      state.setHoverTarget(hover);
    }
  });

  return null;
}

function hoversEqual(a: StreakHoverTarget, b: StreakHoverTarget): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return a.kind === b.kind;
}
