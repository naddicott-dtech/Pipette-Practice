import { describe, it, expect } from 'vitest';
import {
  createField,
  seedPool,
  sampleDensity,
  applyContact,
  cellIndex,
} from './streakField';
import { STREAK_FIELD } from './config';

describe('streak dilution field', () => {
  it('creates a zeroed grid of the right size', () => {
    const f = createField(16, 3);
    expect(f.res).toBe(16);
    expect(f.data).toHaveLength(16 * 16);
    expect(f.data.every((v) => v === 0)).toBe(true);
  });

  it('seeds the pool at its center and leaves far cells empty', () => {
    const f = createField(64, 3);
    seedPool(f, -1.5, -1.5, 0.4, 1);
    expect(sampleDensity(f, -1.5, -1.5)).toBeGreaterThan(0.5);
    expect(sampleDensity(f, 1.5, 1.5)).toBe(0);
  });

  it('deposits onto empty agar (cell rises, load falls)', () => {
    const f = createField(64, 3);
    const before = sampleDensity(f, 0, 0);
    const r = applyContact(f, 0, 0, 1);
    expect(r.deposited).toBeGreaterThan(0);
    expect(sampleDensity(f, 0, 0)).toBeGreaterThan(before);
    expect(r.carried).toBeLessThan(1);
  });

  it('picks up from dense agar with an empty loop (load rises, cell falls)', () => {
    const f = createField(64, 3);
    seedPool(f, 0, 0, 0.5, 1);
    const before = sampleDensity(f, 0, 0);
    const r = applyContact(f, 0, 0, 0);
    expect(r.carried).toBeGreaterThan(0);
    expect(sampleDensity(f, 0, 0)).toBeLessThan(before);
  });

  it('dilutes along a stroke from the pool into fresh agar', () => {
    const f = createField(96, 3);
    seedPool(f, -1.5, -1.5, 0.4, 1);

    // Pick up at the pool, then deposit along a line of fresh cells. Step
    // by more than a cell width so each contact lands on a new (empty) cell.
    const c0 = applyContact(f, -1.5, -1.5, 0).carried;
    let carried = c0;
    const deposits: number[] = [];
    for (let k = 0; k < 50; k++) {
      const x = -1 + k * 0.08; // marching away from the pool into empty agar
      const r = applyContact(f, x, 1.5, carried);
      carried = r.carried;
      deposits.push(r.deposited);
    }

    // Deposits decay monotonically and the load bleeds well down — the tail
    // deposit is a small fraction of the head (the dilution gradient).
    for (let i = 1; i < deposits.length; i++) {
      expect(deposits[i]).toBeLessThanOrEqual(deposits[i - 1] + 1e-9);
    }
    expect(carried).toBeLessThan(c0);
    expect(deposits[deposits.length - 1]).toBeLessThan(deposits[0] * 0.5);
  });

  it('reloads disproportionately from a thin streak (sub-linear pickup)', () => {
    const f = createField(64, 3);
    const i = cellIndex(f, 0, 0)!;
    f.data[i] = 0.04; // a faint prior-quadrant streak cell
    const r = applyContact(f, 0, 0, 0);
    // A purely linear ALPHA·D pickup would be much smaller.
    expect(r.carried).toBeGreaterThan(STREAK_FIELD.ALPHA * 0.04);
  });

  it('caps the carried load', () => {
    const f = createField(32, 3);
    seedPool(f, 0, 0, 0.6, 1);
    let carried = 0;
    for (let k = 0; k < 40; k++) carried = applyContact(f, 0, 0, carried).carried;
    expect(carried).toBeLessThanOrEqual(STREAK_FIELD.CARRIED_MAX + 1e-9);
  });

  it('does not dilute when dragging only through dense agar (lawn)', () => {
    const f = createField(96, 3);
    seedPool(f, 0, 0, 1.2, 1);
    let carried = 1;
    for (let k = 0; k < 30; k++) {
      // Stay inside the dense region the whole time.
      carried = applyContact(f, -0.5 + k * 0.03, 0, carried).carried;
    }
    expect(carried).toBeGreaterThan(0.5);
  });

  it('clamps density and never carries a negative load', () => {
    const f = createField(32, 3);
    seedPool(f, 0, 0, 0.5, 1);
    let carried = 5; // absurdly high
    for (let k = 0; k < 50; k++) {
      const r = applyContact(f, 0, 0, carried);
      carried = r.carried;
      expect(carried).toBeGreaterThanOrEqual(0);
    }
    expect(sampleDensity(f, 0, 0)).toBeLessThanOrEqual(STREAK_FIELD.DMAX + 1e-9);
  });

  it('is a no-op off the grid', () => {
    const f = createField(32, 3);
    const r = applyContact(f, 99, 99, 1);
    expect(r.deposited).toBe(0);
    expect(r.carried).toBe(1);
  });
});
