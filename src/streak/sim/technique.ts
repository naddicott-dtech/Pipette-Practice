import { GROWTH, PLATE, PLATE_ROTATION, POOL, TECHNIQUE } from './config';
import { cellIndex, type StreakField } from './streakField';
import type { Stroke } from './path';

export type TechniqueFlawId =
  | 'redipping'
  | 'noQuadrants'
  | 'oversmear'
  | 'underuse'
  | 'unlinked';

export interface TechniqueFlaw {
  id: TechniqueFlawId;
  tip: string;
}

export interface TechniqueReport {
  /** Outside→inside transitions into the inoculum disc (proper ≈ 1). */
  poolEntries: number;
  /** Quarter-turns the plate was rotated during streaking. */
  rotations: number;
  /** Fraction of stroke points landing in re-crossed cells (over-crossing signal). */
  overlapRatio: number;
  /** Fraction of in-disc coarse bins touched by a streak (whole-plate use). */
  plateCoverage: number;
  /** Streaked cells (D ≥ MIN_VIABLE) outside the seeded pool. */
  streakedCells: number;
  /** Strokes that started in fresh agar (not on the pool or a prior streak). */
  unlinkedStrokes: number;
  flaws: TechniqueFlaw[];
}

const FLAW_TIPS: Record<TechniqueFlawId, string> = {
  redipping:
    'You kept returning to the sample. After the first streak, dip into your previous streak a few times, then drag out into fresh agar.',
  noQuadrants:
    'Rotate the plate ~90° between sets of strokes so each set is a fresh dilution of the last.',
  oversmear:
    'You re-covered streaked agar, so it grew heavy. Drag into fresh agar instead of crossing your own streaks.',
  underuse:
    'Spread your strokes across the dish so colonies have room to separate.',
  unlinked:
    'Your quadrants started in fresh agar. Before dragging a new quadrant out, cross your previous streak a few times to carry a little inoculum over.',
};

/**
 * Analyze *how* the plate was streaked from the recorded paths + plate
 * rotation. All inputs are agar-local (rotation baked out), so the pool and
 * streak geometry are rotation-invariant. Returns raw metrics plus any
 * detected technique flaws (each maps to a corrective tip). Pure/deterministic.
 */
export function analyzeTechnique(
  strokes: Stroke[],
  plateRotation: number,
  field: StreakField,
): TechniqueReport {
  const px = POOL.position[0];
  const pz = POOL.position[2];
  const poolTouchR = POOL.radius * TECHNIQUE.POOL_TOUCH_FACTOR;
  const poolTouchR2 = poolTouchR * poolTouchR;

  const { res, half, data } = field;
  const cell = (2 * half) / res;
  const poolExclR2 = POOL.radius * POOL.radius;

  // One chronological walk over the strokes computes three things:
  //  - poolEntries: outside→inside transitions into the inoculum disc, per stroke.
  //  - hits/totalPoints: how often the path re-covers a cell (over-crossing).
  //  - unlinkedStrokes: strokes whose START is in fresh agar — not near the pool
  //    and not near any EARLIER stroke (a disconnected quadrant). `footprint`
  //    accumulates prior strokes' non-pool cells; each start is tested against it
  //    BEFORE this stroke is added, so a stroke never links to itself.
  let poolEntries = 0;
  let unlinkedStrokes = 0;
  const hits = new Int32Array(res * res);
  const footprint = new Uint8Array(res * res);
  const linkCells = Math.ceil(TECHNIQUE.LINK_RADIUS / cell);
  let totalPoints = 0;
  for (const stroke of strokes) {
    if (stroke.points.length >= 2) {
      const s = stroke.points[0];
      const sdx = s.x - px;
      const sdz = s.z - pz;
      let linked = sdx * sdx + sdz * sdz <= poolTouchR2; // started on the inoculum
      const sc = !linked ? cellIndex(field, s.x, s.z) : null;
      if (sc !== null) {
        const scol = sc % res;
        const srow = (sc - scol) / res;
        for (let dr = -linkCells; dr <= linkCells && !linked; dr++) {
          const rr = srow + dr;
          if (rr < 0 || rr >= res) continue;
          for (let dc = -linkCells; dc <= linkCells; dc++) {
            const cc = scol + dc;
            if (cc < 0 || cc >= res) continue;
            if (footprint[rr * res + cc]) {
              linked = true;
              break;
            }
          }
        }
      }
      if (!linked) unlinkedStrokes++;
    }

    let inside = false;
    for (const p of stroke.points) {
      const dx = p.x - px;
      const dz = p.z - pz;
      const d2 = dx * dx + dz * dz;
      const within = d2 <= poolTouchR2;
      if (within && !inside) poolEntries++;
      inside = within;
      if (d2 > poolExclR2) {
        const ci = cellIndex(field, p.x, p.z);
        if (ci !== null) {
          hits[ci]++;
          totalPoints++;
          footprint[ci] = 1;
        }
      }
    }
  }
  let overCrossedPoints = 0;
  for (let i = 0; i < hits.length; i++) {
    if (hits[i] >= TECHNIQUE.OVERLAP_HITS) overCrossedPoints += hits[i];
  }
  const overlapRatio = totalPoints > 0 ? overCrossedPoints / totalPoints : 0;

  const rotations = Math.round(plateRotation / PLATE_ROTATION.STEP);

  // Field-derived coverage + streaked-cell count, excluding the pre-seeded pool
  // footprint so these measure streak-caused growth, not the inoculum.
  const bins = TECHNIQUE.COVERAGE_BINS;
  const occupied = new Uint8Array(bins * bins);
  let streakedCells = 0;

  for (let row = 0; row < res; row++) {
    const z = -half + (row + 0.5) * cell;
    for (let col = 0; col < res; col++) {
      const x = -half + (col + 0.5) * cell;
      const dxp = x - px;
      const dzp = z - pz;
      if (dxp * dxp + dzp * dzp <= poolExclR2) continue; // skip inoculum
      const d = data[row * res + col];
      if (d < GROWTH.MIN_VIABLE) continue;
      streakedCells++;
      const bc = Math.min(bins - 1, Math.floor(((x + half) / (2 * half)) * bins));
      const br = Math.min(bins - 1, Math.floor(((z + half) / (2 * half)) * bins));
      occupied[br * bins + bc] = 1;
    }
  }

  // Whole-plate use: fraction of bins whose center lies inside the plate disc
  // that were touched by a streak.
  const binSize = (2 * half) / bins;
  const plateR2 = PLATE.radius * PLATE.radius;
  let inDiscBins = 0;
  let occupiedBins = 0;
  for (let br = 0; br < bins; br++) {
    const z = -half + (br + 0.5) * binSize;
    for (let bc = 0; bc < bins; bc++) {
      const x = -half + (bc + 0.5) * binSize;
      if (x * x + z * z > plateR2) continue;
      inDiscBins++;
      if (occupied[br * bins + bc]) occupiedBins++;
    }
  }
  const plateCoverage = inDiscBins > 0 ? occupiedBins / inDiscBins : 0;

  const flaws: TechniqueFlaw[] = [];
  const streakedEnough = streakedCells >= TECHNIQUE.MIN_STREAKED;
  if (poolEntries >= TECHNIQUE.REDIP_MAX_ENTRIES) {
    flaws.push({ id: 'redipping', tip: FLAW_TIPS.redipping });
  }
  if (rotations < 1 && streakedEnough) {
    flaws.push({ id: 'noQuadrants', tip: FLAW_TIPS.noQuadrants });
  }
  if (overlapRatio > TECHNIQUE.OVERSMEAR_RATIO) {
    flaws.push({ id: 'oversmear', tip: FLAW_TIPS.oversmear });
  }
  if (streakedEnough && plateCoverage < TECHNIQUE.WHOLE_PLATE_MIN) {
    flaws.push({ id: 'underuse', tip: FLAW_TIPS.underuse });
  }
  if (unlinkedStrokes >= TECHNIQUE.MAX_UNLINKED) {
    flaws.push({ id: 'unlinked', tip: FLAW_TIPS.unlinked });
  }

  return {
    poolEntries,
    rotations,
    overlapRatio,
    plateCoverage,
    streakedCells,
    unlinkedStrokes,
    flaws,
  };
}
