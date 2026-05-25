import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldPointRef } from '../../scene/usePointerWorld';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

interface CursorProps {
  pointerRef: WorldPointRef;
}

const READY_COLOR = new THREE.Color('#22c55e');
const NOT_READY_COLOR = new THREE.Color('#ef4444');

/**
 * Ground-plane ring at the world point under the cursor. Green when the
 * player is aimed at the actionable target for the current step (the
 * loop holder during GET_LOOP; the plate once the loop is in hand),
 * red otherwise. Ref-driven — no per-frame React state.
 */
export function StreakCursor({ pointerRef }: CursorProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(() => {
    const mesh = meshRef.current;
    const mat = matRef.current;
    if (!mesh || !mat) return;
    const p = pointerRef.current;
    if (!p) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    mesh.position.set(p.x, 0.02, p.z);

    const { step, hoverTarget } = useStreakStore.getState();
    const ready =
      step === StreakStep.GET_LOOP
        ? hoverTarget?.kind === 'loop-holder'
        : hoverTarget?.kind === 'plate';
    mat.color.copy(ready ? READY_COLOR : NOT_READY_COLOR);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <ringGeometry args={[0.3, 0.4, 48]} />
      <meshBasicMaterial
        ref={matRef}
        color={READY_COLOR}
        transparent
        opacity={0.6}
        depthTest={false}
      />
    </mesh>
  );
}
