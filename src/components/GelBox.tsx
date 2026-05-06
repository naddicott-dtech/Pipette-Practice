import React, { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { useStore, WorkflowStep } from '../store';
import { WELLS } from '../scene/targets';
import { wellHighlight } from '../scene/wellHighlight';

const GEL_ORIGIN: [number, number, number] = [3, 0, -1];

/**
 * The electrophoresis chamber. Renders the buffer + gel slab + WELL_COUNT
 * wells. Each well shows:
 *   - active ring (purple) when it matches `activeStep` during LOAD_WELL
 *   - live-hover ring (cyan) when the cursor is over it during LOAD_WELL
 *   - DNA fill block when liquid has been delivered
 *   - migration bands once the run has started
 *
 * The two ring styles can fire simultaneously (cursor on the active well)
 * — the cyan ring is slightly larger so they don't z-fight. Mirrors the
 * SampleTubeRack pattern so players read the two racks the same way.
 *
 * Each `Well` subscribes to the store separately to avoid full-tree
 * re-renders on every store mutation (the Band animation runs at 20Hz).
 */
export function GelBox() {
  const isBoxOn = useStore((s) => s.isBoxOn);

  const wells = useMemo(
    () =>
      WELLS.map((w) => ({
        x: w.position[0] - GEL_ORIGIN[0],
        y: w.position[1] - GEL_ORIGIN[1],
        z: w.position[2] - GEL_ORIGIN[2],
        id: w.index,
      })),
    [],
  );

  return (
    <group position={GEL_ORIGIN}>
      {/* Buffer chamber */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[8, 0.5, 6]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} />
      </mesh>

      {/* Gel slab */}
      <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[7, 0.3, 5]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
      </mesh>

      {wells.map((w) => (
        <Well key={w.id} id={w.id} x={w.x} y={w.y} z={w.z} isBoxOn={isBoxOn} />
      ))}

      <Text position={[0, 0.4, 3.2]} fontSize={0.3} color="white">
        ELECTROPHORESIS CHAMBER
      </Text>

      {/* Polarity labels */}
      <Text
        position={[0, 0.5, 1.8]}
        fontSize={0.2}
        color="#fb7185"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        -
      </Text>
      <Text
        position={[0, 0.5, -2.5]}
        fontSize={0.2}
        color="#60a5fa"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        +
      </Text>
    </group>
  );
}

interface WellProps {
  id: number;
  x: number;
  y: number;
  z: number;
  isBoxOn: boolean;
}

function Well({ id, x, y, z, isBoxOn }: WellProps) {
  const activeStep = useStore((s) => s.activeStep);
  const step = useStore((s) => s.step);
  const hoverTarget = useStore((s) => s.hoverTarget);
  const dna = useStore((s) => s.dnaInWells[id] ?? 0);

  const { active, hover, loaded } = wellHighlight(
    id,
    activeStep,
    hoverTarget,
    step,
    dna,
  );

  // Ghost loaded wells that aren't the current target so the player's
  // attention follows the active step without losing the loaded wells'
  // visible DNA.
  const isPastLane = loaded && step === WorkflowStep.LOAD_WELL && !active;
  const wellBodyOpacity = isPastLane ? 0.55 : 1;

  return (
    <group position={[x, y, z]}>
      {/* Active-target ring (purple). Sits at the same height as the
          tube ring on SampleTubeRack so the two racks read the same. */}
      {active && (
        <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.4, 32]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Live-hover ring (cyan), slightly larger so it doesn't z-fight
          the active ring when both fire on the same well. */}
      {hover && (
        <mesh position={[0, 1.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.5, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Well hole (the recess in the gel slab) */}
      <mesh>
        <boxGeometry args={[0.8, 0.2, 0.4]} />
        <meshStandardMaterial
          color="#1e293b"
          transparent
          opacity={wellBodyOpacity}
        />
      </mesh>

      {/* DNA in well — opacity scales with delivered volume so partial
          (SOFT_STOP_TO_EJECT) ejects look faint. */}
      {dna > 0 && (
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.7, 0.1, 0.3]} />
          <meshStandardMaterial color="#4c1d95" opacity={dna} transparent />
        </mesh>
      )}

      {/* Lane label visible during the load phase; helps the player map
          DNA n → Well n at a glance. */}
      {step === WorkflowStep.LOAD_WELL && (
        <Text
          position={[0, 0.6, 0]}
          fontSize={0.15}
          color={active ? '#a855f7' : 'white'}
          anchorX="center"
          anchorY="middle"
        >
          {`Well ${id + 1}`}
        </Text>
      )}

      {/* Migration bands — kept on the existing setInterval pattern for
          C4. Replaced by useFrame in C6 alongside the run-debrief. */}
      {isBoxOn && dna > 0 && (
        <group>
          {[0.4, 0.7, 1.2, 1.8].map((offset, j) => (
            <Band key={j} offset={offset} />
          ))}
        </group>
      )}
    </group>
  );
}

function Band({ offset }: { offset: number }) {
  const [pos, setPos] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setPos((p) => Math.min(offset, p + 0.01 * (1 / (offset + 1))));
    }, 50);
    return () => clearInterval(timer);
  }, [offset]);

  return (
    <mesh position={[0, -0.05, -pos]}>
      <boxGeometry args={[0.7, 0.02, 0.1]} />
      <meshStandardMaterial color="#4c1d95" opacity={0.8} transparent />
    </mesh>
  );
}
