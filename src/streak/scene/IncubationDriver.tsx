import { useFrame } from '@react-three/fiber';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';
import { INCUBATION } from '../sim/config';

/**
 * Non-render driver that advances INCUBATE → COMPLETE once the growth
 * time-lapse finishes. Keeps the wall-clock check out of the store (the
 * actions stay clock-free, like the pipette sim's tickRun), reading state
 * fresh each frame rather than subscribing.
 */
export function IncubationDriver() {
  useFrame(() => {
    const { step, incubationStartedAt, finishIncubation } =
      useStreakStore.getState();
    if (step !== StreakStep.INCUBATE || incubationStartedAt === null) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - incubationStartedAt >= INCUBATION.DURATION_MS) finishIncubation();
  });

  return null;
}
