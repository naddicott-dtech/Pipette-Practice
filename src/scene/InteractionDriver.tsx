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
 * Hover detection only. Slimmed in C3: previously also owned the
 * hold-to-lower mechanic, depth ramp, PUNCTURE wiring, and the
 * GET_TIP → INTAKE_SAMPLE transition — all gone with the legacy
 * mechanic. Lock and plunger lifecycles now live in PlungerController.
 *
 * Each frame:
 *   1. Read the world pointer.
 *   2. Compute hoverTarget via the pure findHover.
 *   3. Mirror to store.pointer + store.hoverTarget.
 *   4. Mirror hoverTarget.well.index → store.activeWellIndex (legacy
 *      field GelBox still reads through C4).
 *
 * The hover write only fires on actual change — same-shape comparison —
 * so we don't trigger zustand subscriber re-renders every frame.
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

    // Legacy mirror for GelBox alignment ring (dies in C4).
    const wellIdx = hover?.kind === 'well' ? hover.index : null;
    if (state.activeWellIndex !== wellIdx) state.setActiveWellIndex(wellIdx);
  });

  return null;
}

/**
 * Cheap shape-equality for HoverTarget. Avoids unnecessary store writes
 * (which trigger re-renders of all hoverTarget subscribers).
 */
function hoversEqual(a: HoverTarget, b: HoverTarget): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  if (a.kind !== b.kind) return false;
  if (a.kind === 'sample' && b.kind === 'sample') return a.index === b.index;
  if (a.kind === 'well' && b.kind === 'well') return a.index === b.index;
  return true; // tip-rack and trash have no index
}
