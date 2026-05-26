import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStreakStore } from '../store';
import { growthRadius } from '../sim/growth';
import { GROWTH, INCUBATION, PLATE } from '../sim/config';

const MAX_INSTANCES = GROWTH.MAX_COLONIES;
// Sit colonies just above the streak marks so they read as raised growth.
const COLONY_Y = PLATE.surfaceY + 0.016;

// Bright off-white bacterial colonies — pushed well above the tan agar
// (#e9dcab) so isolated single colonies read clearly, with a faint wet
// sheen (low roughness) catching the spotlight. Slight per-colony variation
// keeps a dense lawn from looking like a flat slab.
const BASE = new THREE.Color('#fdfcf3');
const tint = new THREE.Color();
const dummy = new THREE.Object3D();

/**
 * The grown bacterial colonies. One small flattened dome per colony,
 * generated from the density field at incubation start and animated from
 * zero to full size over INCUBATION.DURATION_MS. Built imperatively each
 * frame (ref-driven) from the store's frozen `colonies` list. Rendered
 * inside the rotating agar group so colonies spin with the plate.
 */
export function Colonies() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const lastCount = useRef(-1);
  const settled = useRef(false);

  useFrame(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const { colonies, incubationStartedAt } = useStreakStore.getState();

    if (colonies.length === 0) {
      if (lastCount.current !== 0) {
        mesh.count = 0;
        lastCount.current = 0;
        settled.current = false;
      }
      return;
    }

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const t =
      incubationStartedAt === null
        ? 1
        : (now - incubationStartedAt) / INCUBATION.DURATION_MS;

    // Once fully grown, freeze: stop rewriting matrices every frame.
    if (settled.current && lastCount.current === colonies.length) return;
    if (t >= 1) settled.current = true;
    else settled.current = false;

    for (let i = 0; i < colonies.length && i < MAX_INSTANCES; i++) {
      const c = colonies[i];
      const radius = growthRadius(c.r, t);
      dummy.position.set(c.x, COLONY_Y, c.z);
      dummy.scale.set(radius, radius * 0.7, radius);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Deterministic faint variation keyed off index.
      const v = ((i * 2654435761) % 1000) / 1000;
      tint.copy(BASE).offsetHSL(0, 0, (v - 0.5) * 0.08);
      mesh.setColorAt(i, tint);
    }

    mesh.count = Math.min(colonies.length, MAX_INSTANCES);
    lastCount.current = colonies.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, MAX_INSTANCES]}
      castShadow={false}
    >
      <sphereGeometry args={[1, 10, 8]} />
      <meshStandardMaterial roughness={0.45} metalness={0} />
    </instancedMesh>
  );
}
