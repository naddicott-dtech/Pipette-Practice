import type { InteractionPhase, Vec3 } from '../../sim/types';

// InteractionPhase is generic across sims; re-export so streak modules
// import it from one place. Vec3 likewise.
export type { InteractionPhase, Vec3 };

/**
 * Outer workflow step for the streak-plating sim. Analogous to the
 * pipette sim's WorkflowStep but its own enum (steps differ).
 *
 *   GET_LOOP  pick up the sterile inoculation loop
 *   STREAK    drag the loop across the plate (mechanic lands in Slice 2)
 *   INCUBATE  let the plate grow 24h @ 37°C (Slice 3)
 *   COMPLETE  result + debrief (Slice 3)
 */
export enum StreakStep {
  GET_LOOP = 'GET_LOOP',
  STREAK = 'STREAK',
  INCUBATE = 'INCUBATE',
  COMPLETE = 'COMPLETE',
}

export type StreakHoverTarget =
  | { kind: 'loop-holder' }
  | { kind: 'plate' }
  | null;

/** A non-null hover — the kind that can be a lock target. */
export type StreakLockTarget = Exclude<StreakHoverTarget, null>;
