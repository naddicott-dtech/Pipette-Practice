import * as THREE from 'three';

/**
 * Project a normalized device coordinate (-1..1 on x, y) onto the y=planeY
 * world plane through the given camera. Returns null if the camera ray is
 * parallel to (or pointing away from) the plane.
 *
 * Pure — depends only on the camera's current matrices.
 */
export function projectScreenToPlane(
  camera: THREE.Camera,
  ndc: { x: number; y: number },
  planeY: number,
): { x: number; z: number } | null {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -planeY);
  const hit = new THREE.Vector3();
  const intersection = ray.ray.intersectPlane(plane, hit);
  if (!intersection) return null;
  return { x: hit.x, z: hit.z };
}
