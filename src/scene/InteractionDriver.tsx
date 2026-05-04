import React, { useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { WorldPointRef } from './usePointerWorld';
import { useStore, WorkflowStep } from '../store';
import { findHover } from '../sim/hover';
import { depthFromHoldMs } from '../sim/depth';
import { TIP_RACK, TRASH, SAMPLE_TUBES, WELLS } from './targets';

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
 * Non-rendering. Each frame:
 *  - Reads the world pointer.
 *  - Computes hoverTarget and writes it to the store.
 *  - Mirrors hoverTarget to legacy flags (isNearTips, isNearSample,
 *    activeWellIndex) so older consumers keep working until Chunk C.
 *  - Tracks Space-key hold duration → loweredDepth.
 *  - Advances GET_TIP → INTAKE_SAMPLE when the player lowers fully over
 *    the tip rack.
 *
 * Failure-mode wiring (PUNCTURE etc.) lives in B4.
 */
export function InteractionDriver({ pointerRef }: DriverProps) {
  const holdStart = useRef<number | null>(null);
  const spaceDown = useRef(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || spaceDown.current) return;
      spaceDown.current = true;
      holdStart.current = performance.now();
      useStore.getState().setPlunger(0);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      spaceDown.current = false;
      holdStart.current = null;
    };
    const onBlur = () => {
      spaceDown.current = false;
      holdStart.current = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  useFrame(() => {
    const state = useStore.getState();
    if (state.failure !== null) return;

    // 1. Pointer + hover
    const point = pointerRef.current;
    if (state.pointer !== point) state.setPointer(point);
    const hover = point ? findHover(point, TARGETS) : null;

    // Avoid setting hoverTarget when shape-equal — prevents render churn.
    const prevHover = state.hoverTarget;
    const same =
      (prevHover === null && hover === null) ||
      (prevHover && hover && prevHover.kind === hover.kind &&
        ((prevHover.kind !== 'sample' && prevHover.kind !== 'well') ||
         (prevHover as { index: number }).index === (hover as { index: number }).index));
    if (!same) state.setHoverTarget(hover);

    // Mirror to legacy flags (Chunk C drops these).
    const nearTips = hover?.kind === 'tip-rack';
    const nearSample = hover?.kind === 'sample';
    const activeWell = hover?.kind === 'well' ? hover.index : null;
    if (state.isNearTips !== nearTips) state.setIsNearTips(nearTips);
    if (state.isNearSample !== nearSample) state.setIsNearSample(nearSample);
    if (state.activeWellIndex !== activeWell) state.setActiveWellIndex(activeWell);

    // 2. Lower depth
    const ms = holdStart.current ? performance.now() - holdStart.current : 0;
    const lower = depthFromHoldMs(ms);
    if (state.loweredDepth !== lower.depth) state.setLoweredDepth(lower.depth);
    const lowered = lower.depth >= 1;
    if (state.isLowered !== lowered) state.setIsLowered(lowered);

    // 3. Tip pickup transition
    if (
      state.step === WorkflowStep.GET_TIP &&
      hover?.kind === 'tip-rack' &&
      lowered &&
      !state.hasTip
    ) {
      state.setHasTip(true);
      state.setStep(WorkflowStep.INTAKE_SAMPLE);
    }
  });

  return null;
}
