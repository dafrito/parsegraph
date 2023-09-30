import createException, { BAD_AXIS } from "./Exception";
import Direction, { reverseDirection } from "./Direction";

export enum Axis {
  NULL = 6,
  HORIZONTAL,
  VERTICAL,
  Z,
}
export default Axis;

export function nameAxis(given: Axis): string {
  switch (given) {
    case Axis.NULL:
      return "NULL";
    case Axis.VERTICAL:
      return "VERTICAL";
    case Axis.HORIZONTAL:
      return "HORIZONTAL";
    case Axis.Z:
      return "Z";
  }
}

export function getDirectionAxis(given: Direction): Axis {
  switch (given) {
    case Direction.FORWARD:
    case Direction.BACKWARD:
      return Axis.HORIZONTAL;
    case Direction.DOWNWARD:
    case Direction.UPWARD:
      return Axis.VERTICAL;
    case Direction.INWARD:
    case Direction.OUTWARD:
      return Axis.Z;
    case Direction.NULL:
      return Axis.NULL;
  }
}

export function isVerticalDirection(given: Direction): boolean {
  return getDirectionAxis(given) === Axis.VERTICAL;
}

export function isHorizontalDirection(given: Direction): boolean {
  return getDirectionAxis(given) === Axis.HORIZONTAL;
}

export function getPerpendicularAxis(axisOrDirection: Direction | Axis): Axis {
  switch (axisOrDirection) {
    case Axis.HORIZONTAL:
      return Axis.VERTICAL;
    case Axis.VERTICAL:
      return Axis.HORIZONTAL;
    case Axis.Z:
      return Axis.Z;
    case Axis.NULL:
      return Axis.NULL;
    default:
      // Assume it's a direction.
      return getPerpendicularAxis(getDirectionAxis(axisOrDirection));
  }
}

export function getPositiveDirection(given: Axis) {
  switch (given) {
    case Axis.HORIZONTAL:
      return Direction.FORWARD;
    case Axis.VERTICAL:
      return Direction.DOWNWARD;
    case Axis.Z:
      return Direction.OUTWARD;
    case Axis.NULL:
      throw createException(BAD_AXIS);
  }
}

export function getNegativeDirection(given: Axis): Direction {
  return reverseDirection(getPositiveDirection(given));
}

export function isPositiveDirection(given: Direction): boolean {
  const positiveDirection = getPositiveDirection(getDirectionAxis(given));
  return given === positiveDirection;
}

export function isNegativeDirection(given: Direction): boolean {
  return isPositiveDirection(reverseDirection(given));
}

export function directionSign(given: Direction): number {
  return isPositiveDirection(given) ? 1 : -1;
}
