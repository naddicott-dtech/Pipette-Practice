import { GROWTH } from './config';
import type { StreakField } from './streakField';

/**
 * A single bacterial colony grown from the density field. Center is in
 * agar-local coordinates (same frame as the field + streak marks, so it
 * rotates with the plate); `r` is the colony's final radius once incubation
 * completes.
 */
export interface Colony {
  x: number;
  z: number;
  r: number;
}

export type StreakGrade = 'ok' | 'good' | 'great';

export interface StreakVerdict {
  grade: StreakGrade;
  /** Colonies with no neighbor within GROWTH.ISOLATION_DIST. */
  isolatedCount: number;
  total: number;
}

/**
 * Deterministic per-cell PRNG (mulberry32). Seeded by the cell index so the
 * same field always grows the same colonies — stable frame-to-frame and in
 * tests — without storing any RNG state on the field.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate discrete colonies from the density field. Each cell with density
 * ≥ MIN_VIABLE seeds `floor(λ)` colonies plus one more with probability
 * `frac(λ)`, where `λ = density · SEED_RATE`. Colony centers are jittered
 * within their cell and given a near-constant radius (size is biology, not
 * density), so dilute cells scatter a few separated singles while dense
 * cells pack many overlapping colonies into a lawn. Capped at MAX_COLONIES.
 */
export function generateColonies(field: StreakField): Colony[] {
  const { res, half, data } = field;
  const cell = (2 * half) / res;
  const colonies: Colony[] = [];

  for (let row = 0; row < res; row++) {
    const cz = -half + (row + 0.5) * cell;
    for (let col = 0; col < res; col++) {
      const i = row * res + col;
      const d = data[i];
      if (d < GROWTH.MIN_VIABLE) continue;

      const rng = mulberry32(i + 1);
      const lambda = GROWTH.SEED_RATE * Math.pow(d, GROWTH.SEED_EXP);
      let count = Math.floor(lambda);
      if (rng() < lambda - count) count += 1;
      if (count > GROWTH.MAX_PER_CELL) count = GROWTH.MAX_PER_CELL;

      const cx = -half + (col + 0.5) * cell;
      for (let k = 0; k < count; k++) {
        if (colonies.length >= GROWTH.MAX_COLONIES) return colonies;
        const jx = (rng() - 0.5) * cell;
        const jz = (rng() - 0.5) * cell;
        const r = GROWTH.COLONY_RADIUS * (1 + (rng() - 0.5) * GROWTH.RADIUS_JITTER);
        colonies.push({ x: cx + jx, z: cz + jz, r });
      }
    }
  }
  return colonies;
}

/** Smoothstep-eased radius at incubation progress `t` (clamped to [0,1]). */
export function growthRadius(finalR: number, t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return finalR * c * c * (3 - 2 * c);
}

/**
 * Ballpark grade for a streak: how many well-separated isolated colonies
 * grew. Isolation is the whole lesson — separated single colonies are what
 * let you pick a pure CRISPR-edited clone. A confluent lawn (everything
 * touching) or barely-any growth both grade as "ok".
 */
export function classifyStreak(colonies: Colony[]): StreakVerdict {
  const n = colonies.length;
  const d2 = GROWTH.ISOLATION_DIST * GROWTH.ISOLATION_DIST;
  let isolatedCount = 0;

  for (let i = 0; i < n; i++) {
    const a = colonies[i];
    let isolated = true;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const b = colonies[j];
      const dx = a.x - b.x;
      const dz = a.z - b.z;
      if (dx * dx + dz * dz < d2) {
        isolated = false;
        break;
      }
    }
    if (isolated) isolatedCount++;
  }

  const grade: StreakGrade =
    isolatedCount >= GROWTH.GREAT_MIN
      ? 'great'
      : isolatedCount >= GROWTH.GOOD_MIN
        ? 'good'
        : 'ok';

  return { grade, isolatedCount, total: n };
}
