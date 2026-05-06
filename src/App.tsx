import React from 'react';
import { Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { Pipette } from './components/Pipette';
import { GelBox } from './components/GelBox';
import { Table } from './scene/Table';
import { TipRack } from './scene/TipRack';
import { Trash } from './scene/Trash';
import { SampleTubeRack } from './scene/SampleTubeRack';
import { UIOverlay } from './components/UIOverlay';
import { CameraRig } from './scene/CameraRig';
import { Cursor } from './scene/Cursor';
import { InteractionDriver } from './scene/InteractionDriver';
import { PlungerController } from './scene/PlungerController';
import { usePointerWorld } from './scene/usePointerWorld';

function SceneRoot() {
  const pointerRef = usePointerWorld();
  return (
    <>
      {/* Frame ordering matters:
            1. usePointerWorld writes store.pointer
            2. InteractionDriver reads pointer, writes hoverTarget
            3. PlungerController reads hover/phase, advances curves & rules
            4. CameraRig reads phase + lockedTarget, animates camera
            5. Pipette / SampleTubeRack / Cursor read final store state and render
          PlungerController only mounts inside Canvas because it uses useFrame;
          its keyboard listeners are window-scoped, so it doesn't matter that
          it's nested. */}
      <InteractionDriver pointerRef={pointerRef} />
      <PlungerController />
      <CameraRig />

      <ambientLight intensity={0.5} />
      <spotLight
        position={[10, 15, 10]}
        angle={0.25}
        penumbra={1}
        intensity={1500}
        castShadow
      />
      <pointLight position={[-5, 5, -5]} intensity={500} color="#3b82f6" />

      <Table />
      <TipRack />
      <Trash />
      <SampleTubeRack />
      <GelBox />
      <Pipette />
      <Cursor pointerRef={pointerRef} />

      {/* Floor far below so shadows have somewhere to land. */}
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
      {/* `frameloop="always"` so the scene paints on first mount even
          if the user never moves the mouse — r3f's default `demand`
          mode would leave the canvas black until something invalidates,
          and nothing does until a hover. */}
      <Canvas shadows frameloop="always" gl={{ antialias: true }}>
        <SceneRoot />
      </Canvas>

      <UIOverlay />

      {/* Small-screen warning. Touch isn't supported (yet). */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden bg-red-900/80 p-4 rounded-lg text-center z-50">
        This simulation works best on a larger screen (Chromebook or Desktop).
      </div>
    </div>
  );
}
