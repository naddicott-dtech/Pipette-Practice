/**
 * World ↔ agar-local coordinate transforms. The petri dish is centered at
 * the world origin and the agar group is rotated about the Y axis by
 * `rot` radians (the plate rotation). Streak marks and the density field
 * live in agar-local space (so they spin with the plate); the loop and the
 * cursor live in world space. These pure helpers bridge the two.
 *
 * Three.js Y-rotation (right-handed) maps a local point to world via:
 *   x_w =  cos·lx + sin·lz
 *   z_w = -sin·lx + cos·lz
 * world→local is the inverse (rotate by -rot).
 */
export interface Vec2 {
  x: number;
  z: number;
}

export function agarLocalToWorld(local: Vec2, rot: number): Vec2 {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    x: c * local.x + s * local.z,
    z: -s * local.x + c * local.z,
  };
}

export function worldToAgarLocal(world: Vec2, rot: number): Vec2 {
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  return {
    x: c * world.x - s * world.z,
    z: s * world.x + c * world.z,
  };
}
