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
  INWARD = 0,
  OUTWARD = 1,
  DOWNWARD = 2,
  UPWARD = 3,
  BACKWARD = 4,
  FORWARD = 5,
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
  /**
   * Forward and backward axis.
   */
  HORIZONTAL = NUM_DIRECTIONS,

  /**
   * Upward and downward axis.
   */
  VERTICAL = NUM_DIRECTIONS + 1,

  /**
   * Inward and outward axis.
   */
  Z = NUM_DIRECTIONS + 2,
}
