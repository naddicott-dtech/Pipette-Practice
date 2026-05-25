import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA } from '../sim/config';
import { useStreakStore } from '../store';
import { StreakStep } from '../sim/types';

const DAMP = 3000 / CAMERA.TRANSITION_MS;

function pickPreset(step: StreakStep) {
  // GET_LOOP frames the bench; everything after looks down at the plate.
  return step === StreakStep.GET_LOOP ? CAMERA.OVERVIEW : CAMERA.STREAK_VIEW;
}

/**
 * Single damped PerspectiveCamera that animates between the OVERVIEW and
 * top-down STREAK presets based on the streak store's `step`. Same
 * framerate-independent damp approach as the pipette sim's CameraRig.
 */
export function StreakCameraRig() {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  const lookAt = useRef(new THREE.Vector3(...CAMERA.OVERVIEW.lookAt));
  const tPos = useRef(new THREE.Vector3());
  const tLook = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const cam = ref.current;
    if (!cam) return;

    const { step } = useStreakStore.getState();
    const preset = pickPreset(step);
    tPos.current.set(...preset.position);
    tLook.current.set(...preset.lookAt);

    cam.position.x = THREE.MathUtils.damp(cam.position.x, tPos.current.x, DAMP, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, tPos.current.y, DAMP, dt);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, tPos.current.z, DAMP, dt);

    lookAt.current.x = THREE.MathUtils.damp(lookAt.current.x, tLook.current.x, DAMP, dt);
    lookAt.current.y = THREE.MathUtils.damp(lookAt.current.y, tLook.current.y, DAMP, dt);
    lookAt.current.z = THREE.MathUtils.damp(lookAt.current.z, tLook.current.z, DAMP, dt);
    cam.lookAt(lookAt.current);

    const fov = THREE.MathUtils.damp(cam.fov, preset.fov, DAMP, dt);
    if (Math.abs(cam.fov - fov) > 0.001) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  });

  return (
    <PerspectiveCamera
      ref={ref}
      makeDefault
      position={CAMERA.OVERVIEW.position as unknown as [number, number, number]}
      fov={CAMERA.OVERVIEW.fov}
    />
  );
}
