import { GROWTH } from './config';
import type { StreakField } from './streakField';
import type { Stroke } from './path';
import { analyzeTechnique, type TechniqueFlaw } from './technique';

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
  /** A heavy/confluent growth zone is present (one end of the gradient). */
  hasConfluent: boolean;
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
 * `frac(λ)`, where `λ = SEED_BASELINE + SEED_RATE·density^SEED_EXP` (clamped
 * to MAX_PER_CELL). Colony centers are jittered within their cell and given a
 * near-constant radius (size is biology, not density), so dilute cells scatter
 * a few separated singles while dense cells pack many overlapping colonies
 * into a lawn. The baseline makes growth track *any* streak (a lucky lone
 * ancestor can drop anywhere). If the total exceeds MAX_COLONIES it's thinned
 * by an even stride so spatial coverage stays uniform.
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
      const lambda = Math.min(
        GROWTH.MAX_PER_CELL,
        GROWTH.SEED_BASELINE + GROWTH.SEED_RATE * Math.pow(d, GROWTH.SEED_EXP),
      );
      let count = Math.floor(lambda);
      if (rng() < lambda - count) count += 1;

      const cx = -half + (col + 0.5) * cell;
      for (let k = 0; k < count; k++) {
        const jx = (rng() - 0.5) * cell;
        const jz = (rng() - 0.5) * cell;
        const r = GROWTH.COLONY_RADIUS * (1 + (rng() - 0.5) * GROWTH.RADIUS_JITTER);
        colonies.push({ x: cx + jx, z: cz + jz, r });
      }
    }
  }

  if (colonies.length <= GROWTH.MAX_COLONIES) return colonies;
  // Even thinning (vs. truncating mid-grid, which would starve the far side).
  const stride = colonies.length / GROWTH.MAX_COLONIES;
  const thinned: Colony[] = [];
  for (let k = 0; k < GROWTH.MAX_COLONIES; k++) {
    thinned.push(colonies[Math.floor(k * stride)]);
  }
  return thinned;
}

/** Smoothstep-eased radius at incubation progress `t` (clamped to [0,1]). */
export function growthRadius(finalR: number, t: number): number {
  const c = t < 0 ? 0 : t > 1 ? 1 : t;
  return finalR * c * c * (3 - 2 * c);
}

/**
 * Ballpark grade for a streak, rewarding the full dilution gradient. The
 * point of the technique is to span density zones — a heavy/confluent region
 * grading down to clearly separated single colonies you can pick a pure
 * clone from. So "great" needs BOTH a confluent zone and a healthy number of
 * isolated colonies; "good" has pickable singles but an incomplete gradient;
 * a pure lawn or barely-any growth is "ok".
 */
export function classifyStreak(colonies: Colony[], field: StreakField): StreakVerdict {
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

  let confluentCells = 0;
  for (let i = 0; i < field.data.length; i++) {
    if (field.data[i] >= GROWTH.CONFLUENT_D) confluentCells++;
  }
  const hasConfluent = confluentCells >= GROWTH.CONFLUENT_MIN_CELLS;

  const grade: StreakGrade =
    hasConfluent && isolatedCount >= GROWTH.GREAT_ISO
      ? 'great'
      : isolatedCount >= GROWTH.GOOD_ISO
        ? 'good'
        : 'ok';

  return { grade, isolatedCount, total: n, hasConfluent };
}

const GRADE_RANK: Record<StreakGrade, number> = { ok: 0, good: 1, great: 2 };

/**
 * Highest grade allowed given a flaw count. Good technique earns the colony
 * outcome on its own; each technique flaw lowers the ceiling one tier, so a
 * great-looking outcome from sloppy technique (e.g. the re-dipping starburst)
 * can't read as "Great".
 */
export function ceilingForFlaws(flawCount: number): StreakGrade {
  return flawCount === 0 ? 'great' : flawCount === 1 ? 'good' : 'ok';
}

export interface StreakAssessment {
  /** Final headline grade — the outcome grade capped by technique. */
  grade: StreakGrade;
  /** Outcome grade before the technique cap (for affirmation/debug copy). */
  outcomeGrade: StreakGrade;
  isolatedCount: number;
  total: number;
  hasConfluent: boolean;
  /** Quarter-turns rotated during streaking (for affirmation copy). */
  rotations: number;
  flaws: TechniqueFlaw[];
}

/**
 * Full debrief assessment: the colony outcome (classifyStreak) combined with a
 * technique analysis of the recorded paths. Technique flaws cap the headline
 * grade so that *how* you streaked — not just what happened to grow — decides
 * the score.
 */
export function gradeStreak(
  colonies: Colony[],
  field: StreakField,
  strokes: Stroke[],
  plateRotation: number,
): StreakAssessment {
  const outcome = classifyStreak(colonies, field);
  const tech = analyzeTechnique(strokes, plateRotation, field);
  const ceiling = ceilingForFlaws(tech.flaws.length);
  const grade =
    GRADE_RANK[outcome.grade] <= GRADE_RANK[ceiling] ? outcome.grade : ceiling;

  return {
    grade,
    outcomeGrade: outcome.grade,
    isolatedCount: outcome.isolatedCount,
    total: outcome.total,
    hasConfluent: outcome.hasConfluent,
    rotations: tech.rotations,
    flaws: tech.flaws,
  };
}
