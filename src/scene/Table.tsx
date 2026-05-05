import React from 'react';
import { TABLE } from './targets';

/**
 * The lab bench. A flat slab the lab objects sit on. Pure visual; no
 * interaction. Split out of LabObjects in C3 so each scene-object file
 * stays focused on one thing.
 */
export function Table() {
  return (
    <mesh position={TABLE.position} receiveShadow>
      <boxGeometry args={TABLE.size} />
      <meshStandardMaterial color="#262626" />
    </mesh>
  );
}
