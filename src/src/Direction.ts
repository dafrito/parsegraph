import createException, { BAD_NODE_DIRECTION } from "./Exception";

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
export default Direction;
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

export function readDirection(given: string | Direction): Direction {
  if (typeof given === "number") {
    return given;
  }
  if (typeof given === "string") {
    switch (given.charAt(0)) {
      case "f":
      case "F":
        return Direction.FORWARD;
      case "b":
      case "B":
        return Direction.BACKWARD;
      case "u":
      case "U":
        return Direction.UPWARD;
      case "d":
      case "D":
        return Direction.DOWNWARD;
      case "i":
      case "I":
        return Direction.INWARD;
      case "o":
      case "O":
        return Direction.OUTWARD;
    }
  }

  return Direction.NULL;
}

export function nameDirection(given: Direction): string {
  switch (given) {
    case Direction.NULL:
      return "NULL";
    case Direction.FORWARD:
      return "FORWARD";
    case Direction.BACKWARD:
      return "BACKWARD";
    case Direction.DOWNWARD:
      return "DOWNWARD";
    case Direction.UPWARD:
      return "UPWARD";
    case Direction.INWARD:
      return "INWARD";
    case Direction.OUTWARD:
      return "OUTWARD";
  }
}
export const isDirection = nameDirection;

export function reverseDirection(given: Direction): Direction {
  switch (given) {
    case Direction.NULL:
      return Direction.NULL;
    case Direction.FORWARD:
      return Direction.BACKWARD;
    case Direction.BACKWARD:
      return Direction.FORWARD;
    case Direction.DOWNWARD:
      return Direction.UPWARD;
    case Direction.UPWARD:
      return Direction.DOWNWARD;
    case Direction.INWARD:
      return Direction.OUTWARD;
    case Direction.OUTWARD:
      return Direction.INWARD;
  }
}

export function isCardinalDirection(given: Direction): boolean {
  switch (given) {
    case Direction.NULL:
    case Direction.INWARD:
    case Direction.OUTWARD:
      return false;
    case Direction.UPWARD:
    case Direction.DOWNWARD:
    case Direction.BACKWARD:
    case Direction.FORWARD:
      return true;
  }
}

export function forEachCardinalDirection(func: Function, thisArg?: object) {
  func.call(thisArg, Direction.DOWNWARD);
  func.call(thisArg, Direction.UPWARD);
  func.call(thisArg, Direction.FORWARD);
  func.call(thisArg, Direction.BACKWARD);
}

export function forEachDirection(func: Function, thisArg?: object) {
  func.call(thisArg, Direction.DOWNWARD);
  func.call(thisArg, Direction.UPWARD);
  func.call(thisArg, Direction.FORWARD);
  func.call(thisArg, Direction.BACKWARD);
  func.call(thisArg, Direction.INWARD);
  func.call(thisArg, Direction.OUTWARD);
}

export function alternateDirection(given: Direction): Direction {
  switch (given) {
    case Direction.DOWNWARD:
    case Direction.INWARD:
      return Direction.FORWARD;
    case Direction.FORWARD:
      return Direction.DOWNWARD;
    default:
      throw createException(BAD_NODE_DIRECTION);
  }
}
