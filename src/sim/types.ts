export type Vec3 = readonly [number, number, number];

export type HoverTarget =
  | { kind: 'tip-rack' }
  | { kind: 'sample'; index: number }
  | { kind: 'well'; index: number }
  | { kind: 'trash' }
  | null;

export type FailureCode =
  | 'NO_TIP'
  | 'PUNCTURE'
  | 'NOT_LOW_ENOUGH'
  | 'HARD_STOP_TO_DRAW';

export type WarningCode =
  | 'SOFT_STOP_TO_EJECT'
  | 'NO_FRESH_TIP';
