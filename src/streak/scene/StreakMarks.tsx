import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStreakStore } from '../store';
import { PATH, PLATE } from '../sim/config';

const MAX_INSTANCES = PATH.MAX_STROKES * PATH.MAX_POINTS_PER_STROKE;
const MARK_Y = PLATE.surfaceY + 0.012;

// Deposit value mapped to a fully "solid" mark; lighter deposits read as
// faint dots (the diluted tail of a streak → foreshadows isolation).
const DEPOSIT_NORM = 0.02;
const MIN_RADIUS = 0.045;
const MAX_RADIUS = 0.14;

// Earthy amber, darkening with density — deliberately darker than the pale
// agar (#e9dcab renders near-white under the spotlight) so the streak trail
// stays legible as feedback (a real plate barely shows until it grows).
const DIM = new THREE.Color('#9a7b33');
const BRIGHT = new THREE.Color('#5d4711');

const dummy = new THREE.Object3D();
const color = new THREE.Color();

/**
 * The visible bacterial streaks. One small flattened dome per recorded
 * contact point, sized and tinted by how much was deposited there, so
 * dense early strokes read as solid lines and the diluted tail reads as
 * scattered dots. Built imperatively each frame from the store's strokes
 * (ref-driven, no per-frame React state). Rendered inside the rotating
 * agar group so the marks spin with the plate.
 */
export function StreakMarks() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lastTotal = useRef(-1);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const { strokes } = useStreakStore.getState();

    // Skip the rebuild when no points were added/removed since last frame
    // (the common case: loop up, or nothing newly deposited).
    let total = 0;
    for (const s of strokes) total += s.points.length;
    if (total === lastTotal.current) return;
    lastTotal.current = total;

    let i = 0;
    for (const stroke of strokes) {
      for (const p of stroke.points) {
        if (i >= MAX_INSTANCES) break;
        const intensity = Math.min(1, p.deposit / DEPOSIT_NORM);
        const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(intensity);
        dummy.position.set(p.x, MARK_Y, p.z);
        dummy.scale.set(radius, radius * 0.5, radius);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        color.copy(DIM).lerp(BRIGHT, intensity);
        mesh.setColorAt(i, color);
        i++;
      }
      if (i >= MAX_INSTANCES) break;
    }

    mesh.count = i;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, MAX_INSTANCES]}
      castShadow={false}
    >
      <sphereGeometry args={[1, 8, 6]} />
      <meshStandardMaterial roughness={0.55} metalness={0} />
    </instancedMesh>
  );
}
