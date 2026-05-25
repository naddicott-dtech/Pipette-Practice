import type { Vec2 } from './transform';

/** One recorded contact point with the amount of bacteria deposited there. */
export interface StrokePoint {
  x: number;
  z: number;
  deposit: number;
}

/** A single press→drag→release streak, in agar-local coordinates. */
export interface Stroke {
  points: StrokePoint[];
}

export function createStroke(): Stroke {
  return { points: [] };
}

/**
 * Walk from `prev` toward `curr`, emitting a point every `stepDist` of
 * travel. `leftover` is the distance already accumulated since the last
 * emitted point (always < stepDist). Returns the emitted points plus the
 * new leftover. This makes deposit application distance-based — and thus
 * independent of frame rate and mouse speed.
 */
export function segmentSteps(
  prev: Vec2,
  curr: Vec2,
  leftover: number,
  stepDist: number,
): { points: Vec2[]; leftover: number } {
  const dx = curr.x - prev.x;
  const dz = curr.z - prev.z;
  const dist = Math.hypot(dx, dz);
  if (dist === 0) return { points: [], leftover };

  const total = leftover + dist;
  const n = Math.floor(total / stepDist);
  const points: Vec2[] = [];
  for (let k = 1; k <= n; k++) {
    const along = k * stepDist - leftover;
    const t = along / dist;
    points.push({ x: prev.x + dx * t, z: prev.z + dz * t });
  }
  return { points, leftover: total - n * stepDist };
}

/**
 * Append a contact point to a stroke, dropping points closer than
 * `minSpacing` to the previous one and capping the stroke at `maxPoints`
 * (so a frantic or very long drag can't grow the buffer without bound).
 */
export function pushPoint(
  stroke: Stroke,
  p: Vec2,
  deposit: number,
  minSpacing: number,
  maxPoints: number,
): void {
  if (stroke.points.length >= maxPoints) return;
  const last = stroke.points[stroke.points.length - 1];
  if (last && Math.hypot(p.x - last.x, p.z - last.z) < minSpacing) return;
  stroke.points.push({ x: p.x, z: p.z, deposit });
}
