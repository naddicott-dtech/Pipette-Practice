import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { WorldPointRef } from './usePointerWorld';
import { useStore, WorkflowStep } from '../store';

interface CursorProps {
  pointerRef: WorldPointRef;
}

const READY_COLOR = new THREE.Color('#22c55e');
const NOT_READY_COLOR = new THREE.Color('#ef4444');

/**
 * Ground-plane ring rendered at the world point under the cursor.
 * Color is green when the player has the right thing for the current
 * step (e.g. holding a tip during DRAW_SAMPLE), red otherwise.
 *
 * Reads pointer via the ref pattern — no React state changes per frame.
 */
export function Cursor({ pointerRef }: CursorProps) {
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

    const { hasTip, step } = useStore.getState();
    const ready = step === WorkflowStep.GET_TIP ? !hasTip : hasTip;
    mat.color.copy(ready ? READY_COLOR : NOT_READY_COLOR);
  });

  return (
    <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
      <ringGeometry args={[0.3, 0.4, 48]} />
      <meshBasicMaterial ref={matRef} color={READY_COLOR} transparent opacity={0.6} depthTest={false} />
    </mesh>
  );
}
