import React from 'react';
import { Text } from '@react-three/drei';
import { useStore, WorkflowStep } from '../store';
import { TIP_RACK } from './targets';

/**
 * Tip rack box + glowing alignment ring + visible tips. The glow ring
 * appears during GET_TIP and dims out once the player has a tip.
 *
 * Pure visuals — no interaction logic. Hover/lock detection lives in
 * InteractionDriver/PlungerController; this component just shows what's
 * there.
 */
export function TipRack() {
  const step = useStore((s) => s.step);
  const hasTip = useStore((s) => s.hasTip);
  const showGlow = !hasTip && step === WorkflowStep.GET_TIP;

  return (
    <group position={TIP_RACK.position}>
      {/* Rack body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[3, 0.8, 3]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.1} />
      </mesh>

      {/* Glow ring while the player needs a tip */}
      {showGlow && (
        <mesh position={[0, 0.81, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.3, 48]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.6} />
        </mesh>
      )}

      {/* The visible tips. Hidden once the player has one (we hand-wave
          the depleted rack). */}
      {!hasTip &&
        Array.from({ length: 9 }).map((_, i) => (
          <mesh
            key={i}
            position={[((i % 3) - 1) * 0.6, 0.5, (Math.floor(i / 3) - 1) * 0.6]}
            rotation={[Math.PI, 0, 0]}
            castShadow
          >
            <coneGeometry args={[0.08, 0.4, 8]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
        ))}

      <Text
        position={[0, 0.6, 1.6]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 4, 0, 0]}
      >
        TIPS
      </Text>
    </group>
  );
}
