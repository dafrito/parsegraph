import Direction, { reverseDirection } from "./Direction";
import { getPerpendicularAxis, getPositiveDirection } from "./Axis";
import createException, { BAD_NODE_DIRECTION } from "./Exception";

export function turnLeft(given: Direction): Direction {
  switch (given) {
    case Direction.FORWARD:
      return Direction.UPWARD;
    case Direction.BACKWARD:
      return Direction.DOWNWARD;
    case Direction.DOWNWARD:
      return Direction.FORWARD;
    case Direction.UPWARD:
      return Direction.BACKWARD;
    default:
      throw createException(BAD_NODE_DIRECTION);
  }
}

export function turnRight(given: Direction): Direction {
  return reverseDirection(turnLeft(given));
}

export function turnPositive(direction: Direction): Direction {
  return getPositiveDirection(getPerpendicularAxis(direction));
}

export function turnNegative(direction: Direction): Direction {
  return reverseDirection(turnPositive(direction));
}
