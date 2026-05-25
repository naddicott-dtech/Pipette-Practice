import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';
import { PLATE, POOL } from '../sim/config';

const GUIDE_Y = PLATE.surfaceY + 0.011;
const GUIDE_LEN = PLATE.radius * 2 * 0.92;

/**
 * The agar plate: a shallow translucent dish with a tan agar surface,
 * faint quadrant guide lines, the pre-seeded bacterial pool in one
 * quadrant, and a hover ring that lights up when the player aims at the
 * plate with the loop in hand. Pure visuals.
 */
export function PetriDish() {
  const step = useStreakStore((s) => s.step);
  const hoverTarget = useStreakStore((s) => s.hoverTarget);
  const showHoverRing = step === StreakStep.STREAK && hoverTarget?.kind === 'plate';

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

      {/* Faint quadrant guides */}
      <mesh position={[0, GUIDE_Y, 0]}>
        <boxGeometry args={[GUIDE_LEN, 0.008, 0.03]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>
      <mesh position={[0, GUIDE_Y, 0]}>
        <boxGeometry args={[0.03, 0.008, GUIDE_LEN]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.12} />
      </mesh>

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
