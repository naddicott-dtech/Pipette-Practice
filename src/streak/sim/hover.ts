import type { StreakHoverTarget } from './types';
import type { StreakTargetSet } from './targets';

/** Euclidean XZ distance from a target center to a world point. */
function dist(
  a: readonly [number, number, number],
  p: { x: number; z: number },
): number {
  return Math.hypot(a[0] - p.x, a[2] - p.z);
}

/**
 * Closest streak target whose XZ distance is within its radius. The
 * loop holder wins ties over the (much larger) plate. Returns null when
 * the point is over neither.
 */
export function findStreakHover(
  point: { x: number; z: number },
  targets: StreakTargetSet,
): StreakHoverTarget {
  const candidates: { target: StreakHoverTarget; distance: number }[] = [];

  const dh = dist(targets.loopHolder.position, point);
  if (dh < targets.loopHolder.radius) {
    candidates.push({ target: { kind: 'loop-holder' }, distance: dh });
  }
  const dp = dist(targets.plate.position, point);
  if (dp < targets.plate.radius) {
    candidates.push({ target: { kind: 'plate' }, distance: dp });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0].target;
}
