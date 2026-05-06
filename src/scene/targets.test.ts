import { describe, it, expect } from 'vitest';
import { TIP_RACK, TRASH, SAMPLE_TUBES, WELLS, TABLE } from './targets';
import { WORKFLOW } from '../sim/config';

describe('scene targets', () => {
  it('renders WELL_COUNT wells', () => {
    expect(WELLS).toHaveLength(WORKFLOW.WELL_COUNT);
  });

  it('renders WELL_COUNT sample tubes (one per well)', () => {
    expect(SAMPLE_TUBES).toHaveLength(WORKFLOW.WELL_COUNT);
  });

  it('wells line up along z (same x) and are non-overlapping along z', () => {
    // Post-2026-05-06 layout: wells sit on the chamber's right edge,
    // stacked along the Z axis. A real gel box has wells on one short
    // edge — this matches that.
    for (let i = 1; i < WELLS.length; i++) {
      expect(WELLS[i].position[0]).toBe(WELLS[0].position[0]);
      const dz = WELLS[i].position[2] - WELLS[i - 1].position[2];
      expect(dz).toBeGreaterThan(WELLS[i].radius + WELLS[i - 1].radius - 0.01);
    }
  });

  it('sample tubes are sorted by x and non-overlapping', () => {
    for (let i = 1; i < SAMPLE_TUBES.length; i++) {
      const dx = SAMPLE_TUBES[i].position[0] - SAMPLE_TUBES[i - 1].position[0];
      expect(dx).toBeGreaterThan(0);
    }
  });

  it('each indexed target has matching index', () => {
    SAMPLE_TUBES.forEach((t, i) => expect(t.index).toBe(i));
    WELLS.forEach((w, i) => expect(w.index).toBe(i));
  });

  it('tip rack is left of all wells', () => {
    const minWellX = Math.min(...WELLS.map(w => w.position[0]));
    expect(TIP_RACK.position[0] + TIP_RACK.radius).toBeLessThan(minWellX);
  });

  it('all targets fit on the table footprint', () => {
    const [tw, , td] = TABLE.size;
    const halfW = tw / 2;
    const halfD = td / 2;
    const all = [TIP_RACK, TRASH, ...SAMPLE_TUBES, ...WELLS];
    for (const t of all) {
      expect(Math.abs(t.position[0])).toBeLessThanOrEqual(halfW);
      expect(Math.abs(t.position[2])).toBeLessThanOrEqual(halfD);
    }
  });

  it('all radii are positive', () => {
    const all = [TIP_RACK, TRASH, ...SAMPLE_TUBES, ...WELLS];
    for (const t of all) {
      expect(t.radius).toBeGreaterThan(0);
    }
  });
});
