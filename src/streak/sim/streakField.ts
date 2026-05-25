import { STREAK_FIELD } from './config';

/**
 * The bacterial density field on the agar — a square grid in agar-local
 * space spanning [-half, half] on both axes (the plate's bounding box).
 * `data[row*res + col]` holds the cell's density in [0, DMAX].
 *
 * The streak mechanic is a dilution model: the loop carries a scalar load
 * `C`; at each contact point it picks up some of the cell's density and
 * deposits some of its own load (see `applyContact`). Dragging from the
 * dense pool into fresh agar bleeds `C` down geometrically, so streaks
 * fade along their length toward isolated colonies — the whole lesson.
 */
export interface StreakField {
  res: number;
  half: number;
  data: Float32Array;
}

export function createField(
  res: number = STREAK_FIELD.RESOLUTION,
  half: number = STREAK_FIELD.HALF,
): StreakField {
  return { res, half, data: new Float32Array(res * res) };
}

/** Grid index for an agar-local point, or null if outside the grid. */
export function cellIndex(field: StreakField, x: number, z: number): number | null {
  const { res, half } = field;
  const col = Math.floor(((x + half) / (2 * half)) * res);
  const row = Math.floor(((z + half) / (2 * half)) * res);
  if (col < 0 || col >= res || row < 0 || row >= res) return null;
  return row * res + col;
}

export function sampleDensity(field: StreakField, x: number, z: number): number {
  const i = cellIndex(field, x, z);
  return i === null ? 0 : field.data[i];
}

/**
 * Paint a soft disc of bacterial density (the pre-seeded 100 µL pool) into
 * the field, centered at agar-local (cx, cz). Density falls off smoothly
 * to zero at `radius`. Takes the max with any existing density so repeated
 * seeding never lowers a cell.
 */
export function seedPool(
  field: StreakField,
  cx: number,
  cz: number,
  radius: number,
  density: number,
): void {
  const { res, half } = field;
  const cell = (2 * half) / res;
  for (let row = 0; row < res; row++) {
    const z = -half + (row + 0.5) * cell;
    for (let col = 0; col < res; col++) {
      const x = -half + (col + 0.5) * cell;
      const dist = Math.hypot(x - cx, z - cz);
      if (dist >= radius) continue;
      const falloff = 1 - (dist / radius) * (dist / radius);
      const value = density * falloff;
      const i = row * res + col;
      if (value > field.data[i]) field.data[i] = value;
    }
  }
}

/**
 * One contact step of the loop against the agar at agar-local (x, z) while
 * carrying load `carried`. The loop picks up `ALPHA·D` from the cell and
 * deposits `BETA·C` onto it; densities clamp to [0, DMAX] and the carried
 * load never goes negative. Mutates the cell; returns the new carried load
 * and the amount deposited (used for the visible mark's intensity).
 */
export function applyContact(
  field: StreakField,
  x: number,
  z: number,
  carried: number,
): { carried: number; deposited: number } {
  const i = cellIndex(field, x, z);
  if (i === null) return { carried, deposited: 0 };

  const d = field.data[i];
  const pickup = STREAK_FIELD.ALPHA * d;
  const deposit = STREAK_FIELD.BETA * carried;

  const newD = Math.min(STREAK_FIELD.DMAX, Math.max(0, d - pickup + deposit));
  const newC = Math.max(0, carried - deposit + pickup);

  field.data[i] = newD;
  return { carried: newC, deposited: deposit };
}
