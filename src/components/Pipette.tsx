import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { useStore, WorkflowStep } from '../store';
import { PIPETTE, VOLUME } from '../sim/config';
import { loweredY } from '../sim/depth';

/**
 * Visual-only. Reads pointer + loweredDepth from the store and lerps to
 * a world position. All interaction detection lives in InteractionDriver.
 */
export function Pipette() {
  const group = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(0, PIPETTE.Y_HOVER, 0));

  const hasTip = useStore((s) => s.hasTip);
  const liquidInTip = useStore((s) => s.liquidInTip);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { pointer, hoverTarget, loweredDepth, step } = useStore.getState();
    if (!pointer) return;

    let targetY: number = PIPETTE.Y_HOVER;
    if (loweredDepth > 0) {
      const lowered =
        step === WorkflowStep.LOAD_WELL || hoverTarget?.kind === 'well'
          ? PIPETTE.Y_LOWERED_WELL
          : step === WorkflowStep.INTAKE_SAMPLE || hoverTarget?.kind === 'sample'
            ? PIPETTE.Y_LOWERED_SAMPLE
            : PIPETTE.Y_LOWERED_TIPS;
      targetY = loweredY(PIPETTE.Y_HOVER, lowered, loweredDepth);
    }

    target.current.set(pointer.x, targetY, pointer.z);
    g.position.lerp(target.current, PIPETTE.FOLLOW_LERP);
  });

  return (
    <group ref={group}>
      {/* Pipette body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.15, 3]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Grip/Top */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.4]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {hasTip && (
        <group position={[0, -1.7, 0]}>
          <mesh castShadow rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.08, 0.6, 8]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
          {liquidInTip > 0 && (
            <mesh position={[0, 0.1, 0]}>
              <coneGeometry args={[0.07 * liquidInTip, 0.4 * liquidInTip, 8]} />
              <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
            </mesh>
          )}
        </group>
      )}

      <Html position={[0.5, 0, 0]}>
        <div className="bg-black/50 px-2 py-1 rounded text-[10px] whitespace-nowrap">
          {liquidInTip > 0 ? `${(liquidInTip * VOLUME.MAX_UL).toFixed(1)} μL` : 'Empty'}
        </div>
      </Html>
    </group>
  );
}
