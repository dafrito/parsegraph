// Node Direction

/**
 * The list of axis directions.
 *
 * This is used for the positions of DirectionNode neighbors.
 *
 * It is also used for naming DirectionNode layout Extents.
 *
 * @see {@link DirectionNode}
 * @see {@link Extent}
 */
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

/**
 * The number of axis directions.
 */
export const NUM_DIRECTIONS = 6;

/**
 * The list of axes.
 */
export enum Axis {
  NULL = 6,

  /**
   * Forward and backward axis.
   */
  HORIZONTAL,

  /**
   * Upward and downward axis.
   */
  VERTICAL,

  /**
   * Inward and outward axis.
   */
  Z,
}
