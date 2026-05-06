import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { useStore, WorkflowStep } from '../store';
import { WORKFLOW, RUN_DURATION_MS } from '../sim/config';
import { WELLS } from '../scene/targets';
import { wellHighlight } from '../scene/wellHighlight';
import { SCENE_LANDMARKS } from '../scene/sceneGeometry';
import { BAND_PATTERNS } from '../scene/bandPatterns';

const GEL_ORIGIN: [number, number, number] = [3, 0, 0];

// Chamber dimensions (kept identical to pre-rotation values; the gel
// chamber is naturally rectangular and these read well from OVERVIEW).
const BUFFER_SIZE: [number, number, number] = [8, 0.5, 6];
const SLAB_SIZE: [number, number, number] = [7, 0.3, 5];
// Drawn explicitly as a thin emissive band so the player has a visible
// water line during the LOAD_WELL descent. Source of truth in
// src/scene/sceneGeometry.ts.
const BUFFER_SURFACE_Y = SCENE_LANDMARKS.BUFFER_SURFACE_Y;

/**
 * The electrophoresis chamber. Renders the buffer + gel slab +
 * WELL_COUNT wells. After the 2026-05-06 layout pass:
 *   - wells line up along Z on the chamber's right edge (world x = 6)
 *   - "−" sits at the well end, "+" at the far (left) end
 *   - DNA bands migrate in -X during the run
 *   - each well shows a persistent gold rim so the wells are visible
 *     at every workflow step (not just LOAD_WELL)
 *   - a buffer-surface band marks the water line for descent gauging
 *
 * The two highlight ring styles can fire simultaneously (cursor on the
 * active well) — the cyan ring is slightly larger so they don't z-fight.
 *
 * Each `Well` subscribes via per-slice selectors to avoid re-rendering
 * all wells on every store mutation.
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
      {/* Buffer chamber body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={BUFFER_SIZE} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} />
      </mesh>

      {/* Visible buffer surface — a thin slab at the water line, sized
          short of the well column on the right so it doesn't occlude
          the wells from above. Combined with the well rim and the
          descent-zone color cue, the player has three landmarks for
          gauging LOAD_WELL descent: above the water, at the rim, in
          the well. */}
      <mesh position={[-1, BUFFER_SURFACE_Y, 0]}>
        <boxGeometry args={[BUFFER_SIZE[0] - 3, 0.015, BUFFER_SIZE[2] - 0.1]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={0.5}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Gel slab */}
      <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={SLAB_SIZE} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
      </mesh>

      {wells.map((w) => (
        <Well key={w.id} id={w.id} x={w.x} y={w.y} z={w.z} isBoxOn={isBoxOn} />
      ))}

      <Text position={[0, 0.4, 3.2]} fontSize={0.3} color="white">
        ELECTROPHORESIS CHAMBER
      </Text>

      {/* Polarity labels on the long (X) axis. "−" sits over the wells
          (right edge, world x=7); "+" sits at the migration target
          (left edge, world x=-1). Rotated to lie flat on the slab so
          they read from the OVERVIEW camera. */}
      <Text
        position={[4, 0.4, 0]}
        fontSize={0.4}
        color="#fb7185"
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="center"
        anchorY="middle"
      >
        −
      </Text>
      <Text
        position={[-4, 0.4, 0]}
        fontSize={0.4}
        color="#60a5fa"
        rotation={[-Math.PI / 2, 0, 0]}
        anchorX="center"
        anchorY="middle"
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
  const sourceIndex = useStore((s) => s.wellSources[id] ?? null);
  const interactionPhase = useStore((s) => s.interactionPhase);
  const descentMs = useStore((s) => s.descentMs);

  const { active, hover, loaded } = wellHighlight(
    id,
    activeStep,
    hoverTarget,
    step,
    dna,
  );

  // Live descent feedback: the active well's rim recolors as the tip
  // descends through each zone. Gives the player a strong visual signal
  // for "press now" — without this they have only the timer in their head.
  const showZoneRim =
    active && interactionPhase === 'descending';
  const zoneColor =
    descentMs < WORKFLOW.DESCENT.HIGH_TO_GOOD_MS
      ? '#22d3ee' // cyan — too high, keep waiting
      : descentMs < WORKFLOW.DESCENT.GOOD_TO_PUNCTURE_MS
        ? '#22c55e' // green — press now
        : '#ef4444'; // red — about to puncture

  // Ghost loaded wells that aren't the current target so the player's
  // attention follows the active step without losing the loaded wells'
  // visible DNA.
  const isPastLane = loaded && step === WorkflowStep.LOAD_WELL && !active;
  const wellBodyOpacity = isPastLane ? 0.55 : 1;

  return (
    <group position={[x, y, z]}>
      {/* Persistent gold rim — visible at every workflow step so the
          wells read as wells against the dark slab. */}
      <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.24, 0.32, 32]} />
        <meshBasicMaterial color="#fbbf24" transparent opacity={0.45} />
      </mesh>

      {/* Descent-zone rim. Only fires on the active well during the
          'descending' sub-phase. Recolors with the tip's depth zone
          (cyan → green → red) so the player can press at the green. */}
      {showZoneRim && (
        <mesh position={[0, 0.115, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.22, 0.34, 32]} />
          <meshBasicMaterial
            color={zoneColor}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Active-target ring (purple). */}
      {active && (
        <mesh position={[0, 0.13, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.32, 0.4, 32]} />
          <meshBasicMaterial color="#a855f7" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Live-hover ring (cyan), slightly larger so it doesn't z-fight
          the active ring when both fire on the same well. */}
      {hover && (
        <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.5, 32]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Well hole. Solid (transparent: false) when fully opaque so it
          renders crisply against the transparent slab/buffer; only goes
          transparent when ghosted as a past lane. */}
      <mesh>
        <boxGeometry args={[0.4, 0.2, 0.8]} />
        <meshStandardMaterial
          color="#1e293b"
          transparent={isPastLane}
          opacity={wellBodyOpacity}
        />
      </mesh>

      {/* DNA in well — opacity scales with delivered volume so partial
          (SOFT_STOP_TO_EJECT) ejects look faint. */}
      {dna > 0 && (
        <mesh position={[0, -0.05, 0]}>
          <boxGeometry args={[0.3, 0.1, 0.7]} />
          <meshStandardMaterial color="#4c1d95" opacity={dna} transparent />
        </mesh>
      )}

      {/* Lane label visible whenever the well is empty (so empty wells
          stay readable through the workflow) or during LOAD_WELL (so the
          active well still announces its number). */}
      {(dna === 0 || step === WorkflowStep.LOAD_WELL) && (
        <Text
          position={[0.45, 0.2, 0]}
          fontSize={0.16}
          color={active ? '#a855f7' : 'white'}
          anchorX="left"
          anchorY="middle"
          rotation={[0, -Math.PI / 2, 0]}
        >
          {`Well ${id + 1}`}
        </Text>
      )}

      {/* Migration bands — bands travel along -X (toward the +
          electrode at world x=-1). Each band group keys off the SAMPLE
          loaded into this well (wellSources[id]), not the well's own
          index. So loading sample N into well M renders sample N's
          pattern in well M — a mislabel shows as the wrong-bands-in-
          the-wrong-slot, the way it would on a real gel.
          Animation is a single useFrame per band keyed off
          runStartedAt — no per-band setInterval. */}
      {isBoxOn && dna > 0 && sourceIndex !== null && (
        <group>
          {(BAND_PATTERNS[sourceIndex] ?? []).map((offset, j) => (
            <Band key={j} offset={offset} />
          ))}
        </group>
      )}
    </group>
  );
}

/**
 * One DNA band. Final position along -X is `offset`; current position
 * interpolates linearly with elapsed run time. Reads `runStartedAt`
 * from the store inside the frame loop (not as a hook subscription) so
 * each frame produces a fresh `now - runStartedAt` without re-rendering
 * the whole `Well` subtree on every store mutation.
 *
 * Position is set fully imperatively — no JSX `position` prop. R3F
 * re-applies array-literal position props on every parent re-render,
 * and the parent `Well` subscribes to `hoverTarget` (changes on every
 * cursor move) and `descentMs` (frequent during LOAD_WELL). Without
 * the imperative-only path, bands could get reset to x=0 mid-run.
 *
 * Depth/render-order belt-and-brace (2026-05-08):
 *   - Bands sit at y=0.3 — clearly above the gel slab (top y=0.05) and
 *     the well box (top y=0.15). Bands can never be inside an opaque
 *     mesh's volume, eliminating the front-lane depth-write occlusion
 *     that was hiding migrating bands behind the well box.
 *   - depthTest / depthWrite = false on the material, plus an explicit
 *     renderOrder = 10, so bands always draw in front of every other
 *     mesh regardless of three.js's per-frame transparency sort.
 */
function Band({ offset }: { offset: number }) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const m = meshRef.current;
    if (!m) return;
    m.position.y = 0.3;
    const startedAt = useStore.getState().runStartedAt;
    if (startedAt === null) {
      m.position.x = 0;
      return;
    }
    const t = Math.min(1, Math.max(0, (performance.now() - startedAt) / RUN_DURATION_MS));
    m.position.x = -t * offset;
  });

  return (
    <mesh ref={meshRef} renderOrder={10}>
      <boxGeometry args={[0.12, 0.04, 0.7]} />
      <meshStandardMaterial
        color="#7c3aed"
        emissive="#4c1d95"
        emissiveIntensity={0.5}
        opacity={0.95}
        transparent
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
