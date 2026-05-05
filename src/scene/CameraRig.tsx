import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CAMERA } from '../sim/config';
import { useStore, WorkflowStep } from '../store';
import { OVERVIEW_PRESET, RUN_PRESET, actionPresetFor, type CameraPreset } from './cameraPresets';

const DAMP = 3000 / CAMERA.TRANSITION_MS;

/** When the camera is this close to the ACTION target, the lock has
    "landed" and we can advance committing → locked. World-space distance. */
const COMMIT_THRESHOLD = 0.6;

/**
 * Single camera that animates between three presets — OVERVIEW, ACTION,
 * RUN — driven by the store's `step` and `interactionPhase`. The ACTION
 * preset is computed per-target so the camera always frames the locked
 * object, never a fixed scene origin (the C0 hotfix's lurking bug).
 *
 * Side effect: while in `committing` phase, the rig also advances the
 * phase to `locked` once the camera position is within COMMIT_THRESHOLD
 * world units of the ACTION target. Putting that here keeps the
 * keyboard handler in `PlungerController` simpler — it doesn't need to
 * own the camera tween.
 */
export function CameraRig() {
  const ref = useRef<THREE.PerspectiveCamera>(null);
  const lookAtRef = useRef(new THREE.Vector3(...OVERVIEW_PRESET.lookAt));
  const tmpTargetPos = useRef(new THREE.Vector3());
  const tmpTargetLook = useRef(new THREE.Vector3());

  useFrame((_, dt) => {
    const cam = ref.current;
    if (!cam) return;

    const state = useStore.getState();
    const preset = pickPreset(state.step, state.interactionPhase, state.lockedTarget);

    tmpTargetPos.current.set(...preset.position);
    tmpTargetLook.current.set(...preset.lookAt);

    // Damp position
    cam.position.x = THREE.MathUtils.damp(cam.position.x, tmpTargetPos.current.x, DAMP, dt);
    cam.position.y = THREE.MathUtils.damp(cam.position.y, tmpTargetPos.current.y, DAMP, dt);
    cam.position.z = THREE.MathUtils.damp(cam.position.z, tmpTargetPos.current.z, DAMP, dt);

    // Damp lookAt
    lookAtRef.current.x = THREE.MathUtils.damp(lookAtRef.current.x, tmpTargetLook.current.x, DAMP, dt);
    lookAtRef.current.y = THREE.MathUtils.damp(lookAtRef.current.y, tmpTargetLook.current.y, DAMP, dt);
    lookAtRef.current.z = THREE.MathUtils.damp(lookAtRef.current.z, tmpTargetLook.current.z, DAMP, dt);
    cam.lookAt(lookAtRef.current);

    // Damp fov
    const newFov = THREE.MathUtils.damp(cam.fov, preset.fov, DAMP, dt);
    if (Math.abs(cam.fov - newFov) > 0.001) {
      cam.fov = newFov;
      cam.updateProjectionMatrix();
    }

    // Advance committing → locked once we've landed.
    if (state.interactionPhase === 'committing') {
      const dx = cam.position.x - tmpTargetPos.current.x;
      const dy = cam.position.y - tmpTargetPos.current.y;
      const dz = cam.position.z - tmpTargetPos.current.z;
      if (Math.hypot(dx, dy, dz) < COMMIT_THRESHOLD) {
        useStore.getState().setInteractionPhase('locked');
      }
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

function pickPreset(
  step: WorkflowStep,
  phase: ReturnType<typeof useStore.getState>['interactionPhase'],
  lockedTarget: ReturnType<typeof useStore.getState>['lockedTarget'],
): CameraPreset {
  if (step === WorkflowStep.RUN_GEL || step === WorkflowStep.COMPLETE) {
    return RUN_PRESET;
  }
  if (phase === 'free' || lockedTarget === null) {
    return OVERVIEW_PRESET;
  }
  return actionPresetFor(lockedTarget);
}
