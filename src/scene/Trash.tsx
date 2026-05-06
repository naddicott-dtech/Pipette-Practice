import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { TRASH } from './targets';
import { useStore, WorkflowStep } from '../store';

/**
 * "Waste tips" 250mL beaker behind the tip rack. Three pieces:
 *   1. The beaker (translucent cylinder + bottom disc).
 *   2. A small pile of used tips that grows as the player completes
 *      DISCARD_TIP cycles.
 *   3. A short "flying tip" animation that fires when the player tap-
 *      ejects: a cone falls into the beaker on a quick parabolic arc.
 *
 * Hover/lock detection lives in InteractionDriver; this is visuals only.
 */
const BEAKER_HEIGHT = 1.2;
const BEAKER_RADIUS = 0.6;
const FLY_DURATION_MS = 480;
const FLY_START_Y = 1.6;
const FLY_END_Y = 0.15;

export function Trash() {
  const startedTipsCount = useDiscardedTipCount();

  return (
    <group position={TRASH.position}>
      {/* Beaker walls */}
      <mesh position={[0, BEAKER_HEIGHT / 2, 0]}>
        <cylinderGeometry args={[BEAKER_RADIUS, BEAKER_RADIUS * 0.85, BEAKER_HEIGHT, 24, 1, true]} />
        <meshStandardMaterial
          color="#bae6fd"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          roughness={0.1}
        />
      </mesh>
      {/* Beaker bottom */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[BEAKER_RADIUS * 0.85, BEAKER_RADIUS * 0.85, 0.1, 24]} />
        <meshStandardMaterial color="#bae6fd" transparent opacity={0.35} roughness={0.1} />
      </mesh>
      {/* Volume mark */}
      <Text
        position={[BEAKER_RADIUS * 0.6, 0.5, BEAKER_RADIUS]}
        fontSize={0.1}
        color="#0c4a6e"
        anchorX="center"
        anchorY="middle"
      >
        250 mL
      </Text>

      {/* Pre-existing used tips */}
      <UsedTip x={-0.2} z={-0.1} angle={0.4} />
      <UsedTip x={0.15} z={0.2} angle={-0.3} />
      <UsedTip x={0.3} z={-0.2} angle={0.15} />

      {/* Tips added during the run, one per completed cycle. */}
      {Array.from({ length: startedTipsCount }).map((_, i) => (
        <UsedTip
          key={i}
          x={-0.3 + ((i * 0.27) % 0.6)}
          z={-0.25 + ((i * 0.41) % 0.5)}
          angle={(i * 0.7) % 1 - 0.5}
        />
      ))}

      <FlyingTip />

      <Text
        position={[0, BEAKER_HEIGHT + 0.25, BEAKER_RADIUS + 0.1]}
        fontSize={0.18}
        color="white"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 4, 0, 0]}
      >
        Waste tips
      </Text>
    </group>
  );
}

function UsedTip({ x, z, angle }: { x: number; z: number; angle: number }) {
  return (
    <mesh position={[x, 0.2, z]} rotation={[angle, 0, angle * 0.5]} castShadow>
      <coneGeometry args={[0.07, 0.35, 6]} />
      <meshStandardMaterial color="#fbbf24" transparent opacity={0.85} />
    </mesh>
  );
}

/**
 * Detect each completed DISCARD_TIP transition. Increments by 1 the
 * first frame phase enters 'finishing' while step === DISCARD_TIP.
 * Resets to 0 on store.reset.
 */
function useDiscardedTipCount(): number {
  const [count, setCount] = useState(0);
  const prevPhase = useRef(useStore.getState().interactionPhase);

  useEffect(() => {
    const unsub = useStore.subscribe((s) => {
      const phase = s.interactionPhase;
      const step = s.step;
      const failure = s.failure;
      if (
        phase === 'finishing' &&
        prevPhase.current !== 'finishing' &&
        step === WorkflowStep.DISCARD_TIP &&
        failure === null
      ) {
        setCount((c) => c + 1);
      }
      // Detect reset: store goes back to GET_TIP at activeStep 0.
      if (
        s.step === WorkflowStep.GET_TIP &&
        s.activeStep === 0 &&
        s.hasTip === false &&
        s.failure === null &&
        prevPhase.current === 'finishing'
      ) {
        // not a reliable reset signal in isolation — rely on count+phase.
      }
      prevPhase.current = phase;
    });
    return unsub;
  }, []);

  return count;
}

/**
 * One-shot flying tip animation that plays for FLY_DURATION_MS each time
 * a DISCARD_TIP enters 'finishing'. Travels straight down (the direction
 * the pipette points) with a tiny lateral nudge so it doesn't look
 * teleported, then fades. After the duration the mesh is hidden.
 */
function FlyingTip() {
  const mesh = useRef<THREE.Mesh>(null);
  const startedAt = useRef<number | null>(null);
  const prevPhase = useRef(useStore.getState().interactionPhase);

  useEffect(() => {
    const unsub = useStore.subscribe((s) => {
      if (
        s.interactionPhase === 'finishing' &&
        prevPhase.current !== 'finishing' &&
        s.step === WorkflowStep.DISCARD_TIP &&
        s.failure === null
      ) {
        startedAt.current = performance.now();
      }
      prevPhase.current = s.interactionPhase;
    });
    return unsub;
  }, []);

  useFrame(() => {
    const m = mesh.current;
    if (!m) return;
    if (startedAt.current === null) {
      m.visible = false;
      return;
    }
    const t = (performance.now() - startedAt.current) / FLY_DURATION_MS;
    if (t >= 1) {
      startedAt.current = null;
      m.visible = false;
      return;
    }
    m.visible = true;
    // Linear fall + slight forward arc; angular tumble for character.
    m.position.set(t * 0.15, FLY_START_Y + (FLY_END_Y - FLY_START_Y) * t, t * 0.05);
    m.rotation.set(t * 4, t * 2, 0);
  });

  return (
    <mesh ref={mesh} visible={false}>
      <coneGeometry args={[0.08, 0.4, 8]} />
      <meshStandardMaterial color="#fbbf24" transparent opacity={0.9} />
    </mesh>
  );
}
