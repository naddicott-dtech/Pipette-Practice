import React, { useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment, Float, Text } from '@react-three/drei';
import * as THREE from 'three';
import { useStore, WorkflowStep, FailureMode } from './store';
import { motion, AnimatePresence } from 'motion/react';
import { Pipette } from './components/Pipette';
import { GelBox } from './components/GelBox';
import { LabObjects } from './components/LabObjects';
import { UIOverlay } from './components/UIOverlay';

export default function App() {
  const { step, reset } = useStore();

  return (
    <div className="w-full h-screen bg-neutral-900 overflow-hidden font-sans text-white select-none">
      <Canvas shadows gl={{ antialias: true }}>
        {/* Slightly isometric perspective (B) */}
        <PerspectiveCamera makeDefault position={[8, 8, 12]} fov={35} />
        <OrbitControls 
          enablePan={false} 
          minPolarAngle={Math.PI / 4} 
          maxPolarAngle={Math.PI / 2.2}
          maxDistance={25}
          minDistance={10}
        />
        
        <ambientLight intensity={0.5} />
        <spotLight position={[10, 15, 10]} angle={0.25} penumbra={1} intensity={1500} castShadow />
        <pointLight position={[-5, 5, -5]} intensity={500} color="#3b82f6" />
        
        <LabObjects />
        <GelBox />
        <Pipette />
        
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
          <planeGeometry args={[100, 100]} />
          <meshStandardMaterial color="#171717" roughness={0.8} />
        </mesh>
        
        <Environment preset="city" />
      </Canvas>

      <UIOverlay />
      
      {/* Small Screen Warning */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden bg-red-900/80 p-4 rounded-lg text-center z-50">
        This simulation works best on a larger screen (Chromebook or Desktop).
      </div>
    </div>
  );
}
