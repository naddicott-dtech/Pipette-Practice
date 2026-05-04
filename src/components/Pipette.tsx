import React, { useRef, useState, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore, WorkflowStep, FailureMode } from '../store';
import { Float, Html } from '@react-three/drei';

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
    let targetY = 3.5;
    
    // If lowered, drop it down
    if (isLowered) {
      if (step === WorkflowStep.INTAKE_SAMPLE) targetY = 0.8;
      else if (step === WorkflowStep.LOAD_WELL) targetY = 0.4;
      else targetY = 0.8; // Default lower for tips
    }

    // Smooth follow
    const x = (state.mouse.x * viewport.width) / 1.5;
    const z = -(state.mouse.y * viewport.height) / 1.5;
    
    group.current.position.lerp(new THREE.Vector3(x, targetY, z), 0.1);

    // Dynamic rotation for more "life"
    group.current.rotation.z = -state.mouse.x * 0.1;
    group.current.rotation.x = state.mouse.y * 0.1;
  });

  // Check for interactions based on position
  useFrame(() => {
    if (!group.current || failure !== null) return;
    const pos = group.current.position;

    // TIP RACK: -5, 0, 2
    const distToTips = Math.abs(pos.x - (-5)) + Math.abs(pos.z - 2);
    const nearTips = distToTips < 1.5;
    
    // Optimize: Only update state if value actually changed to prevent console spam/renders
    const state = useStore.getState();
    if (state.isNearTips !== nearTips) state.setIsNearTips(nearTips);

    if (nearTips && !hasTip && isLowered && step === WorkflowStep.GET_TIP) {
      state.setHasTip(true);
      state.setStep(WorkflowStep.INTAKE_SAMPLE);
    }

    // SAMPLE TUBE: -2, 0, 2
    const distToSample = Math.abs(pos.x - (-2)) + Math.abs(pos.z - 2);
    const nearSample = distToSample < 1.0;
    if (state.isNearSample !== nearSample) state.setIsNearSample(nearSample);

    // Only check interactions if lowered
    if (!isLowered) {
      if (state.activeWellIndex !== null) state.setActiveWellIndex(null);
      return;
    }

    // INTERACTION: Load Well DETECTION
    const wellBaseX = 3;
    const wellBaseZ = -1 + 1.5; 
    const wellsX = [-2.4, -1.2, 0, 1.2, 2.4].map(x => x + wellBaseX);
    
    let foundWell: number | null = null;
    wellsX.forEach((wellX, i) => {
      const dx = Math.abs(pos.x - wellX);
      const dz = Math.abs(pos.z - wellBaseZ);
      
      if (dx < 0.6 && dz < 0.6) {
        foundWell = i;
        
        if (step === WorkflowStep.LOAD_WELL) {
          // Height checks at loading
          if (pos.y < 0.6) {
            // Check for puncture (Y < -0.05 is bottom of well)
            if (pos.y < 0.1) {
              setFailure(FailureMode.PUNCTURE);
            } else if (plungerPos > 0.75 && liquidInTip > 0) {
               // Ejecting inside well!
               if (liquidInTip < 0.1) {
                 setStep(WorkflowStep.RUN_GEL);
               }
            }
          } else if (plungerPos > 0.75 && liquidInTip > 0) {
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
           {liquidInTip > 0 ? `${(liquidInTip * 20).toFixed(1)} μL` : 'Empty'}
        </div>
      </Html>
    </group>
  );
}
