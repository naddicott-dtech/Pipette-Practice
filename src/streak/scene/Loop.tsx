import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStreakStore } from '../store';
import { LOOP } from '../sim/config';

const HALF = LOOP.HANDLE_LENGTH / 2;
const WIRE_Y = -HALF - 0.2;
const RING_Y = -HALF - 0.45;
// Lowest point of the horizontal donut tube, relative to the group origin.
// Y_HOVER is tuned so this lands on the agar surface.

/**
 * The inoculation loop: a long yellow handle with a thin wire ring at
 * the tip (the circle in the reference image). Rests tilted in the
 * holder until pickup, then follows the cursor over the plate. Position
 * and tilt lerp/damp toward their targets each frame, like the pipette.
 */
export function Loop() {
  const group = useRef<THREE.Group>(null);
  const targetPos = useRef(new THREE.Vector3(...LOOP.REST_POSITION));

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    const { hasLoop, pointer } = useStreakStore.getState();
    if (hasLoop && pointer) {
      targetPos.current.set(pointer.x, LOOP.Y_HOVER, pointer.z);
    } else {
      targetPos.current.set(...LOOP.REST_POSITION);
    }
    g.position.lerp(targetPos.current, LOOP.FOLLOW_LERP);

    const tilt = hasLoop ? 0 : LOOP.REST_TILT;
    g.rotation.z = THREE.MathUtils.damp(g.rotation.z, tilt, 8, dt);
  });

  return (
    <group
      ref={group}
      position={LOOP.REST_POSITION as unknown as [number, number, number]}
      rotation={[0, 0, LOOP.REST_TILT]}
    >
      {/* Handle — thin gold shaft */}
      <mesh castShadow>
        <cylinderGeometry
          args={[
            LOOP.HANDLE_RADIUS_TOP,
            LOOP.HANDLE_RADIUS_BOTTOM,
            LOOP.HANDLE_LENGTH,
            16,
          ]}
        />
        <meshStandardMaterial color="#fbbf24" roughness={0.4} metalness={0.1} />
      </mesh>

      {/* Wire neck */}
      <mesh position={[0, WIRE_Y, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.4, 8]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* Loop ring — horizontal donut; the tube rests flat on the agar. */}
      <mesh position={[0, RING_Y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[LOOP.RING_RADIUS, LOOP.RING_TUBE, 20, 56]} />
        <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.8} />
      </mesh>
    </group>
  );
}
