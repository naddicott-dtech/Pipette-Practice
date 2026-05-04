import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { projectScreenToPlane } from '../sim/geometry';

export type WorldPointRef = React.MutableRefObject<{ x: number; z: number } | null>;

/**
 * Returns a ref whose .current is the world point on y=0 under the cursor,
 * or null if the cursor's ray doesn't hit the plane. Updated each frame
 * before render. The ref pattern avoids re-renders on every mouse move.
 *
 * Mount once at the Canvas root; pass the ref down or read it from a frame
 * loop alongside this hook.
 */
export function usePointerWorld(): WorldPointRef {
  const ref: WorldPointRef = useRef(null);
  const { camera, pointer } = useThree();

  useFrame(() => {
    ref.current = projectScreenToPlane(camera, { x: pointer.x, y: pointer.y }, 0);
  });

  return ref;
}
