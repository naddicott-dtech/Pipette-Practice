import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { projectScreenToPlane } from './geometry';

function camAt(position: [number, number, number], lookAt: [number, number, number]): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  cam.position.set(...position);
  cam.lookAt(new THREE.Vector3(...lookAt));
  cam.updateMatrixWorld(true);
  return cam;
}

describe('projectScreenToPlane', () => {
  it('center of screen for a camera looking at origin projects near origin on y=0', () => {
    const cam = camAt([8, 8, 12], [0, 0, 0]);
    const p = projectScreenToPlane(cam, { x: 0, y: 0 }, 0);
    expect(p).not.toBeNull();
    expect(Math.abs(p!.x)).toBeLessThan(0.01);
    expect(Math.abs(p!.z)).toBeLessThan(0.01);
  });

  it('returns left of origin for negative ndc.x', () => {
    const cam = camAt([0, 8, 12], [0, 0, 0]);
    const p = projectScreenToPlane(cam, { x: -0.5, y: 0 }, 0);
    expect(p).not.toBeNull();
    expect(p!.x).toBeLessThan(0);
  });

  it('returns right of origin for positive ndc.x', () => {
    const cam = camAt([0, 8, 12], [0, 0, 0]);
    const p = projectScreenToPlane(cam, { x: 0.5, y: 0 }, 0);
    expect(p).not.toBeNull();
    expect(p!.x).toBeGreaterThan(0);
  });

  it('symmetric ndc.x produces symmetric world x', () => {
    const cam = camAt([0, 8, 12], [0, 0, 0]);
    const left = projectScreenToPlane(cam, { x: -0.4, y: 0 }, 0)!;
    const right = projectScreenToPlane(cam, { x: 0.4, y: 0 }, 0)!;
    expect(Math.abs(left.x + right.x)).toBeLessThan(0.01);
  });

  it('returns null when the plane is behind the camera', () => {
    // Camera above y=0 looking down at origin. The ray for ndc (0,0) goes
    // toward the origin; asking for an intersection with y=20 (which is
    // above the camera) requires t<0 → no intersection.
    const cam = camAt([0, 8, 12], [0, 0, 0]);
    const p = projectScreenToPlane(cam, { x: 0, y: 0 }, 20);
    expect(p).toBeNull();
  });

  it('a lower plane is reached further along the camera ray', () => {
    const cam = camAt([8, 8, 12], [0, 0, 0]);
    const p0 = projectScreenToPlane(cam, { x: 0.3, y: -0.3 }, 0);
    const pNeg2 = projectScreenToPlane(cam, { x: 0.3, y: -0.3 }, -2);
    expect(p0).not.toBeNull();
    expect(pNeg2).not.toBeNull();
    // Distance from camera should grow when the plane is lowered.
    const camPos = cam.position;
    const dist0 = Math.hypot(p0!.x - camPos.x, p0!.z - camPos.z, 0 - camPos.y);
    const distNeg2 = Math.hypot(pNeg2!.x - camPos.x, pNeg2!.z - camPos.z, -2 - camPos.y);
    expect(distNeg2).toBeGreaterThan(dist0);
  });
});
