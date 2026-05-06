import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../store';
import { PIPETTE, WORKFLOW } from '../sim/config';
import { lockTargetPosition } from '../scene/cameraPresets';
import type { LockTarget } from '../sim/types';

/**
 * Visual-only pipette. Reads pointer + lockedTarget + plungerCurve from
 * the store and animates accordingly.
 *
 * In LOAD_WELL the body Y is driven by `descentMs` (between Y_DESCENT_START
 * and Y_DESCENT_PUNCTURE) so the player can see the tip lower toward the
 * agar. In other locked phases the body anchors at the per-target Y.
 *
 * The grip (plunger button) descends with `plungerCurve.peakDepth`.
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

    const { pointer, lockedTarget, plungerCurve, interactionPhase, step, descentMs } =
      useStore.getState();

    if (lockedTarget) {
      const [tx, , tz] = lockTargetPosition(lockedTarget);
      targetPos.current.set(tx, anchorYFor(lockedTarget, interactionPhase, step, descentMs), tz);
    } else if (pointer) {
      targetPos.current.set(pointer.x, PIPETTE.Y_HOVER, pointer.z);
    }
    g.position.lerp(targetPos.current, PIPETTE.FOLLOW_LERP);

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
 * Y of the pipette body center when locked onto a given target. For
 * wells the Y interpolates between Y_DESCENT_START and Y_DESCENT_PUNCTURE
 * over `descentMs ∈ [0, AUTO_PUNCTURE_MS]`; once descent stops (good
 * zone → 'locked' / 'acting' / 'finishing'), the Y stays frozen at the
 * captured descentMs so the player sees the tip held in place during
 * the plunger press.
 */
function anchorYFor(
  target: LockTarget,
  phase: import('../sim/types').InteractionPhase,
  _step: import('../sim/types').WorkflowStep,
  descentMs: number,
): number {
  switch (target.kind) {
    case 'tip-rack':
      return PIPETTE.Y_LOWERED_TIPS;
    case 'sample':
      return PIPETTE.Y_LOWERED_SAMPLE;
    case 'well': {
      // 'committing' lands at descent start; 'descending' through
      // 'finishing' interpolate over the captured descentMs.
      if (phase === 'committing') return PIPETTE.Y_DESCENT_START;
      const t = Math.min(1, descentMs / WORKFLOW.DESCENT.AUTO_PUNCTURE_MS);
      return PIPETTE.Y_DESCENT_START +
        t * (PIPETTE.Y_DESCENT_PUNCTURE - PIPETTE.Y_DESCENT_START);
    }
    case 'trash':
      return PIPETTE.Y_LOWERED_TIPS;
  }
}
