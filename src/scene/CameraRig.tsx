import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA } from '../sim/config';
import { useStore } from '../store';

// Damping rate: ~3 time constants ≈ 95% transition.
// lambda = 3000 / TRANSITION_MS gives the right feel for a 450 ms preset.
const DAMP = 3000 / CAMERA.TRANSITION_MS;

const overviewPos = new THREE.Vector3(...CAMERA.OVERVIEW.position);
const closeupPos = new THREE.Vector3(...CAMERA.CLOSEUP.position);
const overviewLook = new THREE.Vector3(...CAMERA.OVERVIEW.lookAt);
const closeupLook = new THREE.Vector3(...CAMERA.CLOSEUP.lookAt);

/**
 * Single camera that animates between OVERVIEW and CLOSEUP based on
 * loweredDepth (0..1). When the player presses Space the camera leans in.
 * No OrbitControls — camera is locked to these two presets.
 */
export function CameraRig() {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  const lookAtRef = useRef(new THREE.Vector3().copy(overviewLook));
  const targetPos = useRef(new THREE.Vector3());
  const targetLook = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const cam = ref.current;
    if (!cam) return;
    const blend = useStore.getState().loweredDepth;

    targetPos.current.copy(overviewPos).lerp(closeupPos, blend);
    targetLook.current.copy(overviewLook).lerp(closeupLook, blend);
    const targetFov = THREE.MathUtils.lerp(CAMERA.OVERVIEW.fov, CAMERA.CLOSEUP.fov, blend);

    cam.position.x = THREE.MathUtils.damp(cam.position.x, targetPos.current.x, DAMP, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, targetPos.current.y, DAMP, dt);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, targetPos.current.z, DAMP, dt);

    lookAtRef.current.x = THREE.MathUtils.damp(lookAtRef.current.x, targetLook.current.x, DAMP, dt);
    lookAtRef.current.y = THREE.MathUtils.damp(lookAtRef.current.y, targetLook.current.y, DAMP, dt);
    lookAtRef.current.z = THREE.MathUtils.damp(lookAtRef.current.z, targetLook.current.z, DAMP, dt);
    cam.lookAt(lookAtRef.current);

    const newFov = THREE.MathUtils.damp(cam.fov, targetFov, DAMP, dt);
    if (Math.abs(cam.fov - newFov) > 0.001) {
      cam.fov = newFov;
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
