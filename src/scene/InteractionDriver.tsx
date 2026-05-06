import React from 'react';
import { useFrame } from '@react-three/fiber';
import type { WorldPointRef } from './usePointerWorld';
import { useStore } from '../store';
import { findHover } from '../sim/hover';
import { TIP_RACK, TRASH, SAMPLE_TUBES, WELLS } from './targets';
import type { HoverTarget } from '../sim/types';

interface DriverProps {
  pointerRef: WorldPointRef;
}

const TARGETS = {
  tipRack: TIP_RACK,
  trash: TRASH,
  sampleTubes: SAMPLE_TUBES,
  wells: WELLS,
} as const;

/**
 * Hover detection. Each frame:
 *   1. Read the world pointer.
 *   2. Compute hoverTarget via the pure findHover.
 *   3. Mirror to store.pointer + store.hoverTarget (only on actual change
 *      — see hoversEqual — so we don't trigger zustand subscriber
 *      re-renders every frame).
 *
 * As of C4 there are no legacy mirrors here. GelBox / SampleTubeRack
 * read `hoverTarget` directly.
 */
export function InteractionDriver({ pointerRef }: DriverProps) {
  useFrame(() => {
    const state = useStore.getState();

    const point = pointerRef.current;
    if (state.pointer !== point) state.setPointer(point);

    const hover = point ? findHover(point, TARGETS) : null;
    if (!hoversEqual(state.hoverTarget, hover)) {
      state.setHoverTarget(hover);
    }
  });

  return null;
}

/** Cheap shape-equality for HoverTarget to gate store writes. */
function hoversEqual(a: HoverTarget, b: HoverTarget): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'sample' && b.kind === 'sample') return a.index === b.index;
  if (a.kind === 'well' && b.kind === 'well') return a.index === b.index;
  return true; // tip-rack and trash have no index
}
