// Node Direction
export enum Direction {
  NULL = -1,
  INWARD,
  OUTWARD,
  DOWNWARD,
  UPWARD,
  BACKWARD,
  FORWARD,
}

export const INWARD = Direction.INWARD;
export const OUTWARD = Direction.OUTWARD;
export const DOWNWARD = Direction.DOWNWARD;
export const UPWARD = Direction.UPWARD;
export const BACKWARD = Direction.BACKWARD;
export const FORWARD = Direction.FORWARD;

export const NUM_DIRECTIONS = 6;

export const HORIZONTAL_ORDER: Direction[] = [
  Direction.INWARD,
  Direction.BACKWARD,
  Direction.FORWARD,
  Direction.DOWNWARD,
  Direction.UPWARD,
  Direction.OUTWARD,
];

export const VERTICAL_ORDER: Direction[] = [
  Direction.INWARD,
  Direction.DOWNWARD,
  Direction.UPWARD,
  Direction.BACKWARD,
  Direction.FORWARD,
  Direction.OUTWARD,
];

export enum Axis {
  NULL = 6,
  HORIZONTAL,
  VERTICAL,
  Z,
}
