import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { PIPETTE } from '../sim/config';
import { lockTargetPosition } from '../scene/cameraPresets';
import type { LockTarget } from '../sim/types';

/**
 * Visual-only pipette. Reads pointer + lockedTarget + plungerCurve from
 * the store and animates accordingly:
 *
 *   - In 'free' phase: follows the cursor at hover height.
 *   - In any locked-and-friends phase: anchors above the locked target
 *     at the appropriate working depth (tip rack, sample tube, well).
 *   - The grip (plunger button) descends with plungerCurve.peakDepth so
 *     the player sees the plunger physically depressing.
 *
 * Tip / liquid geometry corrected per the 2026-05-05 QA follow-up:
 * tip cone matches the shaft diameter and the liquid mesh is oriented
 * apex-down to mirror the tip's interior wall.
 */
export function Pipette() {
  const group = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(0, PIPETTE.Y_HOVER, 0));
  const grip = useRef<THREE.Group>(null);

  const hasTip = useStore((s) => s.hasTip);
  const liquidInTip = useStore((s) => s.liquidInTip);

  useFrame(() => {
    const g = group.current;
    if (!g) return;

    const { pointer, lockedTarget, plungerCurve } = useStore.getState();

    // Position: locked → target's anchor; otherwise → cursor at hover height.
    if (lockedTarget) {
      const [tx, , tz] = lockTargetPosition(lockedTarget);
      targetPos.current.set(tx, anchorYFor(lockedTarget), tz);
    } else if (pointer) {
      targetPos.current.set(pointer.x, PIPETTE.Y_HOVER, pointer.z);
    }
    g.position.lerp(targetPos.current, PIPETTE.FOLLOW_LERP);

    // Plunger visualization: grip descends with peakDepth.
    if (grip.current) {
      const restY = 1.5;
      const maxTravel = 0.5;
      grip.current.position.y = restY - plungerCurve.peakDepth * maxTravel;
    }
  });

  return (
    <group ref={group}>
      {/* Pipette body (the long shaft) */}
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.15, 3]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.1} metalness={0.8} />
      </mesh>

      {/* Plunger grip — animates downward as the curve advances. */}
      <group ref={grip} position={[0, 1.5, 0]}>
        <mesh>
          <cylinderGeometry args={[0.3, 0.3, 0.4]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {/* Soft-stop notch on the body — a thin band the grip passes through.
            Anchored relative to the grip so it scrolls together; visually it
            sits where the soft stop would be on a real pipette barrel. */}
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[0.21, 0.21, 0.04]} />
          <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.4} />
        </mesh>
      </group>

      {/* Disposable tip — base matches shaft (0.15), tapers to a point. */}
      {hasTip && (
        <group position={[0, -1.55, 0]}>
          <mesh castShadow rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.15, 0.9, 8]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
          {liquidInTip > 0 && (
            <mesh
              position={[0, -0.45 + 0.3 * liquidInTip, 0]}
              rotation={[Math.PI, 0, 0]}
            >
              <coneGeometry args={[0.13 * liquidInTip, 0.6 * liquidInTip, 8]} />
              <meshStandardMaterial
                color="#8b5cf6"
                emissive="#8b5cf6"
                emissiveIntensity={0.5}
              />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}

/**
 * Y of the pipette body center when locked onto a given target. Matches
 * the legacy Y_LOWERED_* constants — picked so the tip mesh (which is at
 * group-local y=-1.55, extending another ~0.9 down) lands inside the
 * target's interaction zone.
 */
function anchorYFor(target: LockTarget): number {
  switch (target.kind) {
    case 'tip-rack':
      return PIPETTE.Y_LOWERED_TIPS;
    case 'sample':
      return PIPETTE.Y_LOWERED_SAMPLE;
    case 'well':
      return PIPETTE.Y_LOWERED_WELL;
    case 'trash':
      return PIPETTE.Y_LOWERED_TIPS; // similar height to tip rack
  }
}
