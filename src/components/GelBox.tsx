import React, { useMemo, useEffect, useState } from 'react';
import { useStore, WorkflowStep } from '../store';
import { Text } from '@react-three/drei';

export function GelBox() {
  const { isBoxOn, dnaInWells, step } = useStore();

  const wells = useMemo(() => {
    return Array.from({ length: 5 }).map((_, i) => ({
      x: (i - 2) * 1.2,
      id: i
    }));
  }, []);

  return (
    <group position={[3, 0, -1]}>
      {/* Buffer Chamber */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[8, 0.5, 6]} />
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.3} />
      </mesh>

      {/* The Gel Slab */}
      <mesh position={[0, -0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[7, 0.3, 5]} />
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.5} />
      </mesh>

      {/* Wells */}
      {wells.map((well) => (
        <group key={well.id} position={[well.x, 0.05, 1.5]}>
          {/* Alignment guide */}
          {step === WorkflowStep.LOAD_WELL && well.id === 0 && (
            <mesh position={[0, 1, 0]} rotation={[-Math.PI/2, 0, 0]}>
              <ringGeometry args={[0.35, 0.45, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} />
            </mesh>
          )}

          {/* Well hole visual */}
          <mesh>
            <boxGeometry args={[0.8, 0.2, 0.4]} />
            <meshStandardMaterial color="#1e293b" />
          </mesh>
          
          {/* DNA in well (Dark rectangle) */}
          {dnaInWells[well.id] > 0 && (
            <mesh position={[0, -0.05, 0]}>
              <boxGeometry args={[0.7, 0.1, 0.3]} />
              <meshStandardMaterial color="#4c1d95" opacity={dnaInWells[well.id]} transparent />
            </mesh>
          )}

          {/* Running Bands (simulated after box is on) */}
          {isBoxOn && dnaInWells[well.id] > 0 && (
            <group>
               {[0.4, 0.7, 1.2, 1.8].map((offset, j) => (
                 <Band key={j} offset={offset} wellId={well.id} />
               ))}
            </group>
          )}
        </group>
      ))}

      <Text
        position={[0, 0.4, 3.2]}
        fontSize={0.3}
        color="white"
      >
        ELECTROPHORESIS CHAMBER
      </Text>

      {/* Polarity Labels */}
      <Text
        position={[0, 0.5, 1.8]}
        fontSize={0.2}
        color="#fb7185" // Reddish
        rotation={[-Math.PI / 2, 0, 0]}
      >
        -
      </Text>
      <Text
        position={[0, 0.5, -2.5]}
        fontSize={0.2}
        color="#60a5fa" // Bluish
        rotation={[-Math.PI / 2, 0, 0]}
      >
        +
      </Text>
    </group>
  );
}

function Band({ offset, wellId }: { offset: number, wellId: number }) {
  const [pos, setPos] = React.useState(0);
  
  React.useEffect(() => {
    // Basic migration simulation
    const timer = setInterval(() => {
      setPos(p => Math.min(offset, p + 0.01 * (1 / (offset + 1))));
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
