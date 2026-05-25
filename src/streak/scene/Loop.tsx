import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStreakStore } from '../store';
import { LOOP, PLATE } from '../sim/config';

const TILT = LOOP.TILT_X;
const R = LOOP.RING_RADIUS;
const T = LOOP.RING_TUBE;
const H = LOOP.HANDLE_LENGTH;

// Group Y so the leading (downhill) edge of the tilted donut just touches
// the agar surface.
const GROUND_Y = PLATE.surfaceY + R * Math.sin(TILT) + T * Math.cos(TILT);
// Forward (+Z) distance from the group origin to that contact edge. We
// offset the follow target by -FWD so the contact edge — the part that
// drags the sample — sits directly under the cursor.
const FWD = R * Math.cos(TILT) - T * Math.sin(TILT);

/**
 * The inoculation loop: a thin straight handle ending in a wire ring,
 * held at a fixed forward tilt so the ring's leading edge drags across
 * the agar (rigid — no flexing/gouging). Rests in the holder until
 * pickup, then the contact edge follows the cursor over the plate.
 */
export function Loop() {
  const group = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(...LOOP.REST_POSITION));

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { hasLoop, pointer } = useStreakStore.getState();
    if (hasLoop && pointer) {
      target.current.set(pointer.x, GROUND_Y, pointer.z - FWD);
    } else {
      target.current.set(...LOOP.REST_POSITION);
    }
    g.position.lerp(target.current, LOOP.FOLLOW_LERP);
  });

  return (
    <group
      ref={group}
      position={LOOP.REST_POSITION as unknown as [number, number, number]}
      rotation={[TILT, 0, 0]}
    >
      {/* Loop ring — its leading edge drags the sample across the agar. */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[R, T, 20, 56]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Wire neck rising from the back edge of the loop */}
      <mesh position={[0, 0.18, -R]}>
        <cylinderGeometry args={[0.025, 0.025, 0.36, 8]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Thin straight handle, attached at the back edge of the loop */}
      <mesh position={[0, H / 2 + 0.3, -R]} castShadow>
        <cylinderGeometry
          args={[LOOP.HANDLE_RADIUS_TOP, LOOP.HANDLE_RADIUS_BOTTOM, H, 16]}
        />
        <meshStandardMaterial color="#fbbf24" roughness={0.4} metalness={0.1} />
      </mesh>
    </group>
  );
}
