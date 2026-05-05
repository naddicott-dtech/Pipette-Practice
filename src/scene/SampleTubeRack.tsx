import React from 'react';
import { Text } from '@react-three/drei';
import { useStore, WorkflowStep } from '../store';
import { SAMPLE_TUBES } from './targets';

/**
 * Four sample tubes. Each renders:
 *   - a holder cube
 *   - the tube cylinder (translucent walls + colored liquid inside)
 *   - a "DNA n" label
 *   - state-driven rings:
 *       * active-step ring (purple) — the tube the workflow says to draw next
 *       * live-hover ring (cyan) — whichever tube the cursor is currently over
 *       * used-tube treatment — opacity drop on the tube body once drawn
 *
 * The two ring styles can be visible simultaneously: when both point at
 * the same tube, they overlap (the player is on target). When they
 * differ, the player can read the mismatch *before* committing — and
 * `tryDrawSample` will fire `WRONG_TUBE` if they commit anyway.
 */
export function SampleTubeRack() {
  const step = useStore((s) => s.step);
  const activeStep = useStore((s) => s.activeStep);
  const hoverTarget = useStore((s) => s.hoverTarget);
  const usedTubes = useStore((s) => s.usedTubes);

  const isDrawStep = step === WorkflowStep.DRAW_SAMPLE;
  const hoveredTubeIndex =
    hoverTarget?.kind === 'sample' ? hoverTarget.index : null;

  return (
    <group>
      {SAMPLE_TUBES.map((tube) => {
        const isActive = isDrawStep && tube.index === activeStep;
        const isHovered = isDrawStep && hoveredTubeIndex === tube.index;
        const isUsed = usedTubes.includes(tube.index);

        // Tubes ghost slightly once used; the active one stays bright.
        const tubeOpacity = isUsed && !isActive ? 0.4 : 0.9;
        const liquidOpacity = isUsed ? 0.2 : 1.0;

        return (
          <group key={tube.index} position={tube.position}>
            {/* Active-target ring (purple) */}
            {isActive && (
              <mesh position={[0, 1.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.32, 0.4, 32]} />
                <meshBasicMaterial color="#a855f7" transparent opacity={0.8} />
              </mesh>
            )}

            {/* Live-hover ring (cyan) — slightly larger so the two rings
                don't z-fight when both fire on the same tube. */}
            {isHovered && (
              <mesh position={[0, 1.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.42, 0.5, 32]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} />
              </mesh>
            )}

            {/* Holder cube */}
            <mesh castShadow>
              <boxGeometry args={[0.6, 0.6, 0.6]} />
              <meshStandardMaterial color="#404040" />
            </mesh>

            {/* Tube cylinder with liquid */}
            <group position={[0, 0.5, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.2, 0.15, 0.8]} />
                <meshStandardMaterial
                  color="#f0f9ff"
                  transparent
                  opacity={0.4 * (tubeOpacity / 0.9)}
                  roughness={0}
                />
              </mesh>
              <mesh position={[0, -0.15, 0]}>
                <cylinderGeometry args={[0.18, 0.15, 0.4]} />
                <meshStandardMaterial
                  color="#8b5cf6"
                  emissive="#8b5cf6"
                  emissiveIntensity={0.5 * liquidOpacity}
                  transparent
                  opacity={liquidOpacity}
                />
              </mesh>
            </group>

            <Text
              position={[0, 1.4, 0]}
              fontSize={0.18}
              color={isActive ? '#a855f7' : 'white'}
              anchorX="center"
              anchorY="middle"
            >
              {`DNA ${tube.index + 1}`}
            </Text>
          </group>
        );
      })}
    </group>
  );
}
