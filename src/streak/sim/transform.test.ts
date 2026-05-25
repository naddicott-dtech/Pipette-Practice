import { describe, it, expect } from 'vitest';
import { agarLocalToWorld, worldToAgarLocal } from './transform';

describe('agar coordinate transforms', () => {
  it('round-trips world → local → world', () => {
    const rot = 0.73;
    const world = { x: 1.4, z: -0.9 };
    const local = worldToAgarLocal(world, rot);
    const back = agarLocalToWorld(local, rot);
    expect(back.x).toBeCloseTo(world.x, 10);
    expect(back.z).toBeCloseTo(world.z, 10);
  });

  it('is the identity at zero rotation', () => {
    const p = { x: 2, z: -3 };
    const local = worldToAgarLocal(p, 0);
    expect(local.x).toBeCloseTo(2, 10);
    expect(local.z).toBeCloseTo(-3, 10);
  });

  it('maps axes for a quarter turn', () => {
    // local→world by +90° about Y (right-handed): (1,0) → (0,-1).
    const w = agarLocalToWorld({ x: 1, z: 0 }, Math.PI / 2);
    expect(w.x).toBeCloseTo(0, 10);
    expect(w.z).toBeCloseTo(-1, 10);
  });
});
