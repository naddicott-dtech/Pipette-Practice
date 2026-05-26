import { usePointerWorld } from '../../scene/usePointerWorld';
import { Table } from '../../scene/Table';
import { StreakInteractionDriver } from './StreakInteractionDriver';
import { StreakContactDriver } from './StreakContactDriver';
import { StreakInputController } from './StreakInputController';
import { IncubationDriver } from './IncubationDriver';
import { StreakCameraRig } from './StreakCameraRig';
import { PetriDish } from './PetriDish';
import { LoopHolder } from './LoopHolder';
import { Loop } from './Loop';
import { StreakCursor } from './StreakCursor';

/**
 * Streak scene composition. Frame ordering mirrors the pipette sim's
 * SceneRoot: pointer hook → hover driver → input → camera → meshes →
 * cursor. No drei <Environment> here — the agar/plastic/loop are matte
 * enough to read under direct lights, which also avoids the remote HDR
 * fetch (keeps the scene resilient on locked-down networks).
 */
export function StreakSceneRoot() {
  const pointerRef = usePointerWorld();

  return (
    <>
      <StreakInteractionDriver pointerRef={pointerRef} />
      <StreakContactDriver pointerRef={pointerRef} />
      <StreakInputController />
      <IncubationDriver />
      <StreakCameraRig />

      <ambientLight intensity={0.5} />
      <spotLight
        position={[8, 15, 8]}
        angle={0.3}
        penumbra={1}
        intensity={1500}
        castShadow
      />
      <pointLight position={[-6, 6, -4]} intensity={400} color="#f8fafc" />

      <Table />
      <PetriDish />
      <LoopHolder />
      <Loop />
      <StreakCursor pointerRef={pointerRef} />

      {/* Floor below the bench so shadows have somewhere to land. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -2, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#171717" roughness={0.8} />
      </mesh>
    </>
  );
}
