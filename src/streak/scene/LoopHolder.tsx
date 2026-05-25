import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';
import { LOOP_HOLDER } from '../sim/config';

/**
 * The stand the sealed sterile loop rests in. Shows a gold glow ring
 * while the player still needs to pick up the loop. The loop mesh itself
 * lives in Loop.tsx (it sits here until pickup, then follows the cursor).
 */
export function LoopHolder() {
  const step = useStreakStore((s) => s.step);
  const hasLoop = useStreakStore((s) => s.hasLoop);
  const showGlow = step === StreakStep.GET_LOOP && !hasLoop;

  return (
    <group position={LOOP_HOLDER.position}>
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.5, 0.9]} />
        <meshStandardMaterial color="#334155" roughness={0.5} metalness={0.1} />
      </mesh>

      {showGlow && (
        <mesh position={[0, 0.52, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.0, 1.12, 48]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}
