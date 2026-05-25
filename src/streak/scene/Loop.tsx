import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStreakStore } from '../store';
import { LOOP, PLATE } from '../sim/config';

const TILT = LOOP.TILT_X;
const R = LOOP.RING_RADIUS;
const T = LOOP.RING_TUBE;
const H = LOOP.HANDLE_LENGTH;

// Lift the assembly so the bottom of the tilted ring's tube touches the
// agar. The ring's bottom point sits at the tilt-group origin, which the
// outer group pins to the cursor on the surface.
const CONTACT_Y = PLATE.surfaceY + T * Math.cos(TILT);

/**
 * The inoculation loop. The thin straight handle is COPLANAR with the
 * wire ring — the shaft axis is a diameter of the donut, so extending it
 * runs from the top of the handle, through where it meets the ring, and
 * on through the donut again. The assembly is held at a fixed tilt so the
 * ring's bottom edge drags on the agar (rigid — no flexing/gouging). The
 * contact point follows the cursor; the loop rests in its holder until
 * pickup.
 */
export function Loop() {
  const group = useRef<THREE.Group>(null);
  const target = useRef(new THREE.Vector3(...LOOP.REST_POSITION));

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const { hasLoop, pointer } = useStreakStore.getState();
    if (hasLoop && pointer) {
      target.current.set(pointer.x, CONTACT_Y, pointer.z);
    } else {
      target.current.set(...LOOP.REST_POSITION);
    }
    g.position.lerp(target.current, LOOP.FOLLOW_LERP);
  });

  return (
    <group
      ref={group}
      position={LOOP.REST_POSITION as unknown as [number, number, number]}
    >
      {/* Tilt the whole coplanar loop+handle about X; the ring's bottom
          point stays at the origin (the agar contact under the cursor). */}
      <group rotation={[TILT, 0, 0]}>
        {/* Wire ring in the XY plane — its plane contains the handle axis.
            Centered at (0, R) so its bottom point sits at the origin. */}
        <mesh position={[0, R, 0]} castShadow>
          <torusGeometry args={[R, T, 20, 56]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Thin straight handle continuing up the loop's axis from the top
            of the ring. Same plane as the ring (a diameter extended). */}
        <mesh position={[0, 2 * R + H / 2, 0]} castShadow>
          <cylinderGeometry
            args={[LOOP.HANDLE_RADIUS_TOP, LOOP.HANDLE_RADIUS_BOTTOM, H, 16]}
          />
          <meshStandardMaterial color="#fbbf24" roughness={0.4} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}
