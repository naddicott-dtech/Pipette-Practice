import { describe, it, expect } from 'vitest';
import { createStroke, segmentSteps, pushPoint } from './path';

describe('stroke recording', () => {
  it('emits evenly spaced points along a segment', () => {
    const { points, leftover } = segmentSteps({ x: 0, z: 0 }, { x: 1, z: 0 }, 0, 0.25);
    expect(points).toHaveLength(4);
    expect(points[0].x).toBeCloseTo(0.25, 10);
    expect(points[3].x).toBeCloseTo(1, 10);
    expect(leftover).toBeCloseTo(0, 10);
  });

  it('carries leftover distance into the next segment', () => {
    const first = segmentSteps({ x: 0, z: 0 }, { x: 0.3, z: 0 }, 0, 0.25);
    expect(first.points).toHaveLength(1);
    expect(first.leftover).toBeCloseTo(0.05, 10);
    const second = segmentSteps({ x: 0.3, z: 0 }, { x: 0.5, z: 0 }, first.leftover, 0.25);
    expect(second.points).toHaveLength(1);
    expect(second.points[0].x).toBeCloseTo(0.5, 10);
  });

  it('emits nothing for a zero-length segment', () => {
    const { points, leftover } = segmentSteps({ x: 1, z: 1 }, { x: 1, z: 1 }, 0.1, 0.25);
    expect(points).toHaveLength(0);
    expect(leftover).toBe(0.1);
  });

  it('decimates points closer than the minimum spacing', () => {
    const s = createStroke();
    pushPoint(s, { x: 0, z: 0 }, 1, 0.05, 100);
    pushPoint(s, { x: 0.01, z: 0 }, 1, 0.05, 100); // too close, dropped
    pushPoint(s, { x: 0.1, z: 0 }, 1, 0.05, 100);
    expect(s.points).toHaveLength(2);
  });

  it('caps the number of points per stroke', () => {
    const s = createStroke();
    for (let k = 0; k < 50; k++) pushPoint(s, { x: k, z: 0 }, 1, 0.01, 10);
    expect(s.points).toHaveLength(10);
  });
});
