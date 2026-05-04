import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, WorkflowStep, FailureMode } from '../store';
import { Float, Html } from '@react-three/drei';
import { PIPETTE, VOLUME, PLUNGER } from '../sim/config';
import { TIP_RACK, SAMPLE_TUBES, WELLS } from '../scene/targets';

export function Pipette() {
  const group = useRef<THREE.Group>(null);
  const { step, plungerPos, hasTip, liquidInTip, setLiquid, setStep, setFailure, addDnaToWell, failure, isLowered, setIsLowered } = useStore();
  const { viewport, mouse, raycaster, scene } = useThree();

  // Handle Keyboard for lowering
  React.useEffect(() => {
    const handleDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsLowered(true);
        useStore.getState().setPlunger(0); // Snap plunger to rest when starting
      }
    };
    const handleUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsLowered(false);
    };
    window.addEventListener('keydown', handleDown);
    window.addEventListener('keyup', handleUp);
    return () => {
      window.removeEventListener('keydown', handleDown);
      window.removeEventListener('keyup', handleUp);
    };
  }, []);

  // Mouse tracking on a virtual plane at table height
  useFrame((state) => {
    if (!group.current) return;
    
    // Base height
    let targetY: number = PIPETTE.Y_HOVER;

    // If lowered, drop it down
    if (isLowered) {
      if (step === WorkflowStep.INTAKE_SAMPLE) targetY = PIPETTE.Y_LOWERED_SAMPLE;
      else if (step === WorkflowStep.LOAD_WELL) targetY = PIPETTE.Y_LOWERED_WELL;
      else targetY = PIPETTE.Y_LOWERED_TIPS;
    }

    // Smooth follow
    const x = (state.mouse.x * viewport.width) / 1.5;
    const z = -(state.mouse.y * viewport.height) / 1.5;
    
    group.current.position.lerp(new THREE.Vector3(x, targetY, z), PIPETTE.FOLLOW_LERP);

    // Dynamic rotation for more "life"
    group.current.rotation.z = -state.mouse.x * 0.1;
    group.current.rotation.x = state.mouse.y * 0.1;
  });

  // Check for interactions based on position
  useFrame(() => {
    if (!group.current || failure !== null) return;
    const pos = group.current.position;

    // TIP RACK
    const distToTips = Math.abs(pos.x - TIP_RACK.position[0]) + Math.abs(pos.z - TIP_RACK.position[2]);
    const nearTips = distToTips < TIP_RACK.radius;

    // Optimize: Only update state if value actually changed to prevent console spam/renders
    const state = useStore.getState();
    if (state.isNearTips !== nearTips) state.setIsNearTips(nearTips);

    if (nearTips && !hasTip && isLowered && step === WorkflowStep.GET_TIP) {
      state.setHasTip(true);
      state.setStep(WorkflowStep.INTAKE_SAMPLE);
    }

    // SAMPLE TUBE — legacy nearest-tube proximity, kept until Chunk B refactor.
    // Threshold (1.0) preserved verbatim from pre-Chunk-A behavior; Chunk B
    // generalizes to per-tube proximity using `IndexedTarget.radius`.
    const sampleTube = SAMPLE_TUBES[0];
    const LEGACY_SAMPLE_PROXIMITY = 1.0;
    const distToSample = Math.abs(pos.x - sampleTube.position[0]) + Math.abs(pos.z - sampleTube.position[2]);
    const nearSample = distToSample < LEGACY_SAMPLE_PROXIMITY;
    if (state.isNearSample !== nearSample) state.setIsNearSample(nearSample);

    // Only check interactions if lowered
    if (!isLowered) {
      if (state.activeWellIndex !== null) state.setActiveWellIndex(null);
      return;
    }

    // INTERACTION: Load Well DETECTION
    let foundWell: number | null = null;
    WELLS.forEach((well) => {
      const dx = Math.abs(pos.x - well.position[0]);
      const dz = Math.abs(pos.z - well.position[2]);

      if (dx < well.radius && dz < well.radius) {
        foundWell = well.index;

        if (step === WorkflowStep.LOAD_WELL) {
          // Height checks at loading
          if (pos.y < PIPETTE.Y_LOWERED_WELL + 0.2) {
            if (pos.y < PIPETTE.Y_PUNCTURE + 0.05) {
              setFailure(FailureMode.PUNCTURE);
            } else if (plungerPos > PLUNGER.HARD_STOP - 0.25 && liquidInTip > 0) {
              if (liquidInTip < VOLUME.EMPTY_EPS * 2) {
                setStep(WorkflowStep.RUN_GEL);
              }
            }
          } else if (plungerPos > PLUNGER.HARD_STOP - 0.25 && liquidInTip > 0) {
            // Ejecting too high (Overflow)
            setFailure(FailureMode.OVERFLOW);
          }
        }
      }
    });
    if (state.activeWellIndex !== foundWell) state.setActiveWellIndex(foundWell);
  });

  return (
    <group ref={group}>
      {/* Pipette body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.2, 0.15, 3]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.1} metalness={0.8} />
      </mesh>
      
      {/* Grip/Top */}
      <mesh position={[0, 1.5, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.4]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      {/* The Tip (only if picked up) */}
      {hasTip && (
        <group position={[0, -1.7, 0]}>
          <mesh castShadow rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.08, 0.6, 8]} />
            <meshStandardMaterial color="#fbbf24" transparent opacity={0.9} />
          </mesh>
          
          {/* Liquid inside the tip */}
          {liquidInTip > 0 && (
            <mesh position={[0, 0.1, 0]} rotation={[0, 0, 0]}>
              <coneGeometry args={[0.07 * liquidInTip, 0.4 * liquidInTip, 8]} />
              <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
            </mesh>
          )}
        </group>
      )}

      {/* Guides / Cursors */}
      <mesh position={[0, -group.current?.position.y || 0, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <ringGeometry args={[0.3, 0.35, 32]} />
        <meshBasicMaterial color={hasTip ? "#22c55e" : "#ef4444"} transparent opacity={0.5} />
      </mesh>

      {/* Visual Indicator of current Volume */}
      <Html position={[0.5, 0, 0]}>
        <div className="bg-black/50 px-2 py-1 rounded text-[10px] whitespace-nowrap">
           {liquidInTip > 0 ? `${(liquidInTip * VOLUME.MAX_UL).toFixed(1)} μL` : 'Empty'}
        </div>
      </Html>
    </group>
  );
}
