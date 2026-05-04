import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Pipette } from './components/Pipette';
import { GelBox } from './components/GelBox';
import { LabObjects } from './components/LabObjects';
import { UIOverlay } from './components/UIOverlay';
import { CameraRig } from './scene/CameraRig';
import { Cursor } from './scene/Cursor';
import { InteractionDriver } from './scene/InteractionDriver';
import { usePointerWorld } from './scene/usePointerWorld';

function SceneRoot() {
  const pointerRef = usePointerWorld();
  return (
    <>
      {/* Frame ordering: pointer hook → driver writes store → camera/pipette read.
          CameraRig lives here (not at the Canvas root) so its useFrame registers
          after usePointerWorld and InteractionDriver. */}
      <InteractionDriver pointerRef={pointerRef} />
      <CameraRig />

      <ambientLight intensity={0.5} />
      <spotLight position={[10, 15, 10]} angle={0.25} penumbra={1} intensity={1500} castShadow />
      <pointLight position={[-5, 5, -5]} intensity={500} color="#3b82f6" />

      <LabObjects />
      <GelBox />
      <Pipette />
      <Cursor pointerRef={pointerRef} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#171717" roughness={0.8} />
      </mesh>

      <Environment preset="city" />
    </>
  );
}

export default function App() {
  return (
    <div className="w-full h-screen bg-neutral-900 overflow-hidden font-sans text-white select-none">
      <Canvas shadows gl={{ antialias: true }}>
        <SceneRoot />
      </Canvas>

      <UIOverlay />

      {/* Small Screen Warning */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden bg-red-900/80 p-4 rounded-lg text-center z-50">
        This simulation works best on a larger screen (Chromebook or Desktop).
      </div>
    </div>
  );
}
