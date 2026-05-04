import { describe, it, expect } from 'vitest';
import { findHover, type TargetSet } from './hover';
import { TIP_RACK, TRASH, SAMPLE_TUBES, WELLS } from '../scene/targets';

const TARGETS: TargetSet = {
  tipRack: TIP_RACK,
  trash: TRASH,
  sampleTubes: SAMPLE_TUBES,
  wells: WELLS,
};

describe('findHover', () => {
  it('returns null over empty space', () => {
    expect(findHover({ x: 0, z: 0 }, TARGETS)).toBeNull();
  });

  it('detects tip rack at its center', () => {
    const [x, , z] = TIP_RACK.position;
    expect(findHover({ x, z }, TARGETS)).toEqual({ kind: 'tip-rack' });
  });

  it('detects trash at its center', () => {
    const [x, , z] = TRASH.position;
    expect(findHover({ x, z }, TARGETS)).toEqual({ kind: 'trash' });
  });

  it('detects each well at its center', () => {
    WELLS.forEach((w) => {
      const [x, , z] = w.position;
      expect(findHover({ x, z }, TARGETS)).toEqual({ kind: 'well', index: w.index });
    });
  });

  it('detects each sample tube at its center', () => {
    SAMPLE_TUBES.forEach((s) => {
      const [x, , z] = s.position;
      expect(findHover({ x, z }, TARGETS)).toEqual({ kind: 'sample', index: s.index });
    });
  });

  it('does not detect a target just outside its radius (rightmost well)', () => {
    // Use the last well so we step into open table space, not into the
    // adjacent well (wells touch at radius boundaries by design).
    const last = WELLS[WELLS.length - 1];
    const [x, , z] = last.position;
    const justOutside = last.radius + 0.05;
    expect(findHover({ x: x + justOutside, z }, TARGETS)).toBeNull();
  });

  it('detects a target just inside its radius', () => {
    const [x, , z] = WELLS[0].position;
    const justInside = WELLS[0].radius - 0.05;
    expect(findHover({ x: x + justInside, z }, TARGETS)).toEqual({
      kind: 'well',
      index: 0,
    });
  });

  it('picks the closer of two overlapping targets', () => {
    const w0 = WELLS[0].position;
    const w1 = WELLS[1].position;
    const closerToW0 = { x: (w0[0] * 0.7 + w1[0] * 0.3), z: w0[2] };
    expect(findHover(closerToW0, TARGETS)).toEqual({ kind: 'well', index: 0 });
  });

  it('returns null far off the table', () => {
    expect(findHover({ x: 1000, z: 1000 }, TARGETS)).toBeNull();
  });
});
