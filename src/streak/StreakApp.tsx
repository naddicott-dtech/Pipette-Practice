import { Canvas } from '@react-three/fiber';
import { StreakSceneRoot } from './scene/StreakSceneRoot';
import { StreakPrompt } from './ui/StreakPrompt';
import { RotateControl } from './ui/RotateControl';

export default function StreakApp() {
  return (
    <div className="w-full h-screen bg-neutral-900 overflow-hidden font-sans text-white select-none">
      <Canvas shadows frameloop="always" gl={{ antialias: true }}>
        <StreakSceneRoot />
      </Canvas>

      <StreakPrompt />
      <RotateControl />

      {/* Small-screen warning. Touch isn't supported (yet). */}
      <div className="fixed bottom-4 left-4 right-4 md:hidden bg-red-900/80 p-4 rounded-lg text-center z-50">
        This simulation works best on a larger screen (Chromebook or Desktop).
      </div>
    </div>
  );
}
