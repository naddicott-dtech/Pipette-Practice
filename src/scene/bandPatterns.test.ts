import { describe, it, expect } from 'vitest';
import { BAND_PATTERNS } from './bandPatterns';
import { WORKFLOW } from '../sim/config';

describe('BAND_PATTERNS', () => {
  it('has one pattern per well', () => {
    expect(BAND_PATTERNS).toHaveLength(WORKFLOW.WELL_COUNT);
  });

  it('every lane has at least one band', () => {
    for (const pattern of BAND_PATTERNS) {
      expect(pattern.length).toBeGreaterThan(0);
    }
  });

  it('lane 2 and lane 4 share a literal array reference', () => {
    // Identity (===), not deep-equal — pins the "shared const" pattern
    // so future tweaks to one lane automatically apply to the other
    // duplicate-control sample.
    expect(BAND_PATTERNS[1]).toBe(BAND_PATTERNS[3]);
  });

  it('lane 1 (ladder) differs from the lane-2/4 sample', () => {
    expect(BAND_PATTERNS[0]).not.toEqual(BAND_PATTERNS[1]);
  });

  it('lane 3 differs from lanes 1 and 2/4', () => {
    expect(BAND_PATTERNS[2]).not.toEqual(BAND_PATTERNS[0]);
    expect(BAND_PATTERNS[2]).not.toEqual(BAND_PATTERNS[1]);
  });

  it('all migration distances are positive and within the slab half-width', () => {
    // The gel slab is 7 units wide on X; bands migrate from x=0 (well
    // local origin) toward -X. Even the longest-migrating band must
    // stay inside the slab so it doesn't fly off the chamber.
    const slabHalfWidth = 7 / 2;
    for (const pattern of BAND_PATTERNS) {
      for (const offset of pattern) {
        expect(offset).toBeGreaterThan(0);
        expect(offset).toBeLessThan(slabHalfWidth);
      }
    }
  });

  it('lane 1 has more bands than the sample lanes (acts as a ladder)', () => {
    expect(BAND_PATTERNS[0].length).toBeGreaterThan(BAND_PATTERNS[1].length);
    expect(BAND_PATTERNS[0].length).toBeGreaterThan(BAND_PATTERNS[2].length);
  });
});
