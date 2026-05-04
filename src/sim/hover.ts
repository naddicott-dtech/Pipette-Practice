import type { HoverTarget } from './types';
import type { IndexedTarget, Target } from '../scene/targets';

export interface TargetSet {
  tipRack: Target;
  trash: Target;
  sampleTubes: IndexedTarget[];
  wells: IndexedTarget[];
}

interface Candidate {
  target: HoverTarget;
  distance: number;
  radius: number;
}

function manhattan(
  a: readonly [number, number, number],
  p: { x: number; z: number },
): number {
  return Math.abs(a[0] - p.x) + Math.abs(a[2] - p.z);
}

/**
 * Given a world point on the table plane and the set of interactable
 * targets, return the closest target whose Manhattan distance is within
 * its radius. Wells take priority over tubes over tip-rack/trash on a
 * tie (which shouldn't happen with the current layout, but the priority
 * makes hover deterministic). Returns null if the point is over nothing.
 */
export function findHover(
  point: { x: number; z: number },
  targets: TargetSet,
): HoverTarget {
  const candidates: Candidate[] = [];

  for (const w of targets.wells) {
    const d = manhattan(w.position, point);
    if (d < w.radius) candidates.push({ target: { kind: 'well', index: w.index }, distance: d, radius: w.radius });
  }
  for (const s of targets.sampleTubes) {
    const d = manhattan(s.position, point);
    if (d < s.radius) candidates.push({ target: { kind: 'sample', index: s.index }, distance: d, radius: s.radius });
  }
  {
    const d = manhattan(targets.tipRack.position, point);
    if (d < targets.tipRack.radius) candidates.push({ target: { kind: 'tip-rack' }, distance: d, radius: targets.tipRack.radius });
  }
  {
    const d = manhattan(targets.trash.position, point);
    if (d < targets.trash.radius) candidates.push({ target: { kind: 'trash' }, distance: d, radius: targets.trash.radius });
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0].target;
}
