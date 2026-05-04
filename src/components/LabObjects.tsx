import React from 'react';
import { Text } from '@react-three/drei';
import { useStore, WorkflowStep } from '../store';
import { TIP_RACK, SAMPLE_TUBES, TABLE } from '../scene/targets';

export function LabObjects() {
  const step = useStore((s) => s.step);
  const hasTip = useStore((s) => s.hasTip);
  const isLowered = useStore((s) => s.isLowered);
  const setHasTip = useStore((s) => s.setHasTip);
  const setStep = useStore((s) => s.setStep);

  return (
    <group>
      {/* Table top */}
      <mesh position={TABLE.position} receiveShadow>
        <boxGeometry args={TABLE.size} />
        <meshStandardMaterial color="#262626" />
      </mesh>

      {/* Tip Rack */}
      <group position={TIP_RACK.position}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[3, 0.8, 3]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.1} />
        </mesh>
        
        {/* Glow if hovering nearby and needs tip */}
        {!hasTip && step === WorkflowStep.GET_TIP && (
          <mesh position={[0, 0.8, 0]} rotation={[-Math.PI/2, 0, 0]}>
            <ringGeometry args={[1.2, 1.3, 32]} />
            <meshBasicMaterial color="#fbbf24" transparent opacity={0.5} />
          </mesh>
        )}

        {/* Visual placeholders for tips */}
        {!hasTip && Array.from({ length: 9 }).map((_, i) => (
          <mesh 
            key={i}
            position={[
              (i % 3 - 1) * 0.6,
              0.5,
              (Math.floor(i / 3) - 1) * 0.6
            ]}
            rotation={[Math.PI, 0, 0]}
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

      {/* Sample Tube Rack */}
      {SAMPLE_TUBES.map((tube) => (
        <group key={tube.index} position={tube.position}>
          {step === WorkflowStep.INTAKE_SAMPLE && tube.index === 0 && (
            <mesh position={[0, 1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[0.3, 0.4, 32]} />
              <meshBasicMaterial color="#8b5cf6" transparent opacity={0.5} />
            </mesh>
          )}
          {/* Tube holder */}
          <mesh castShadow>
            <boxGeometry args={[0.6, 0.6, 0.6]} />
            <meshStandardMaterial color="#404040" />
          </mesh>
          {/* Sample Tube */}
          <group position={[0, 0.5, 0]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.2, 0.15, 0.8]} />
              <meshStandardMaterial color="#f0f9ff" transparent opacity={0.4} roughness={0} />
            </mesh>
            {/* Liquid in tube */}
            <mesh position={[0, -0.15, 0]}>
              <cylinderGeometry args={[0.18, 0.15, 0.4]} />
              <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.5} />
            </mesh>
          </group>
          <Text
            position={[0, 1.4, 0]}
            fontSize={0.18}
            color="white"
            anchorX="center"
            anchorY="middle"
          >
            {`DNA ${tube.index + 1}`}
          </Text>
        </group>
      ))}
    </group>
  );
}
