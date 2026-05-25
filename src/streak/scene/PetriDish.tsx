import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';
import { PLATE, POOL, PLATE_ROTATION } from '../sim/config';
import { StreakMarks } from './StreakMarks';

const GUIDE_Y = PLATE.surfaceY + 0.011;
const GUIDE_LEN = PLATE.radius * 2 * 0.92;
const ROT_DAMP = 3000 / PLATE_ROTATION.TRANSITION_MS;

/**
 * The agar plate. A static shell (agar disc, rim, fixed quadrant cross,
 * hover ring) holds a rotating inner group with the pre-seeded pool and
 * the streak marks — so when the player rotates the plate, the bacteria
 * spin beneath the fixed quadrant guides while the loop stays put. The
 * quadrant cross is world-fixed on purpose: it marks the streak zone the
 * player keeps returning to as the agar turns under it.
 */
export function PetriDish() {
  const step = useStreakStore((s) => s.step);
  const hoverTarget = useStreakStore((s) => s.hoverTarget);
  const showHoverRing = step === StreakStep.STREAK && hoverTarget?.kind === 'plate';

  const agar = useRef<THREE.Group>(null);

  useFrame((_, dt) => {
    const g = agar.current;
    if (!g) return;
    const { plateRotation, rotating, finishRotation } = useStreakStore.getState();
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, plateRotation, ROT_DAMP, dt);
    if (rotating && Math.abs(g.rotation.y - plateRotation) < 0.002) {
      g.rotation.y = plateRotation;
      finishRotation();
    }
  });

  return (
    <group position={PLATE.position}>
      {/* Agar */}
      <mesh position={[0, PLATE.surfaceY / 2, 0]} receiveShadow>
        <cylinderGeometry args={[PLATE.radius, PLATE.radius, PLATE.surfaceY, 64]} />
        <meshStandardMaterial color="#e9dcab" roughness={0.95} metalness={0} />
      </mesh>

      {/* Dish rim */}
      <mesh position={[0, PLATE.surfaceY * 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[PLATE.radius + 0.05, 0.08, 16, 80]} />
        <meshStandardMaterial color="#cbd5e1" transparent opacity={0.5} roughness={0.2} />
      </mesh>

      {/* Faint quadrant guides — world-fixed (the streak-zone reference) */}
      <mesh position={[0, GUIDE_Y, 0]}>
        <boxGeometry args={[GUIDE_LEN, 0.008, 0.03]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, GUIDE_Y, 0]}>
        <boxGeometry args={[0.03, 0.008, GUIDE_LEN]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>

      {/* Rotating agar contents: pool + streak marks */}
      <group ref={agar}>
        {/* Pre-seeded bacterial pool (the 100 µL drop) */}
        <mesh position={[POOL.position[0], POOL.position[1] + 0.02, POOL.position[2]]}>
          <sphereGeometry args={[POOL.radius, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color="#dfe6c8"
            transparent
            opacity={0.65}
            roughness={0.3}
            emissive="#aebd86"
            emissiveIntensity={0.15}
          />
        </mesh>

        <StreakMarks />
      </group>

      {/* Hover ring when aiming at the plate with the loop */}
      {showHoverRing && (
        <mesh position={[0, PLATE.surfaceY + 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[PLATE.radius - 0.12, PLATE.radius + 0.02, 80]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}
