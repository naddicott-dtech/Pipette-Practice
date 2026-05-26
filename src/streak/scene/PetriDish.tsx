import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';
import { PLATE, POOL, PLATE_ROTATION } from '../sim/config';
import { StreakMarks } from './StreakMarks';
import { Colonies } from './Colonies';

const GUIDE_Y = PLATE.surfaceY + 0.011;
const GUIDE_LEN = PLATE.radius * 2 * 0.92;
const ROT_DAMP = 3000 / PLATE_ROTATION.TRANSITION_MS;

// Fresh agar is a pale amber; as the plate incubates it deepens to a dark
// grey-green so the bright off-white colonies read with strong contrast —
// matching how a grown plate photographs (white growth on dark medium).
const AGAR_FRESH = new THREE.Color('#e9dcab');
const AGAR_GROWN = new THREE.Color('#4f574a');

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
  const discMat = useRef<THREE.MeshStandardMaterial>(null);
  const poolMat = useRef<THREE.MeshStandardMaterial>(null);

  useFrame((_, dt) => {
    const { plateRotation, rotating, finishRotation, step } =
      useStreakStore.getState();

    const g = agar.current;
    if (g) {
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, plateRotation, ROT_DAMP, dt);
      if (rotating && Math.abs(g.rotation.y - plateRotation) < 0.002) {
        g.rotation.y = plateRotation;
        finishRotation();
      }
    }

    // Deepen the agar as it incubates (and ease back on reset). Slow damp so
    // it darkens over the growth time-lapse rather than snapping.
    const grown = step === StreakStep.INCUBATE || step === StreakStep.COMPLETE;
    const k = 1 - Math.exp(-1.2 * dt);
    const mat = discMat.current;
    if (mat) mat.color.lerp(grown ? AGAR_GROWN : AGAR_FRESH, k);
    // Let the grown colonies overtake the raw inoculum drop.
    const pm = poolMat.current;
    if (pm) pm.opacity = THREE.MathUtils.damp(pm.opacity, grown ? 0 : 0.65, 4, dt);
  });

  return (
    <group position={PLATE.position}>
      {/* Agar */}
      <mesh position={[0, PLATE.surfaceY / 2, 0]} receiveShadow>
        <cylinderGeometry args={[PLATE.radius, PLATE.radius, PLATE.surfaceY, 64]} />
        <meshStandardMaterial ref={discMat} color="#e9dcab" roughness={0.95} metalness={0} />
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
            ref={poolMat}
            color="#dfe6c8"
            transparent
            opacity={0.65}
            roughness={0.3}
            emissive="#aebd86"
            emissiveIntensity={0.15}
          />
        </mesh>

        <StreakMarks />
        <Colonies />
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
