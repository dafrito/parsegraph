import { DirectionNode } from "../../DirectionNode";
import {
  Direction,
  isCardinalDirection,
  nameDirection,
  getDirectionAxis,
  Axis,
} from "../../../Direction";

export const findConsecutiveLength = (
  node: DirectionNode,
  inDirection: Direction
): number => {
  // Exclude some directions that cannot be calculated.
  if (!isCardinalDirection(inDirection)) {
    throw new Error(
      "Given direction is not cardinal: " + nameDirection(inDirection)
    );
  }

  const directionAxis: Axis = getDirectionAxis(inDirection);
  if (directionAxis === Axis.NULL) {
    // This should be impossible.
    throw new Error("Cardinal direction somehow has no axis?");
  }

  // Calculate the length, starting from the center of this node.
  let total: number = 0;
  let scale: number = 1.0;

  // Iterate in the given direction.
  if (node.neighbors().hasNode(inDirection)) {
    total += node.neighbors().separationAt(inDirection);

    scale *= node.neighbors().nodeAt(inDirection).scale();
    let thisNode: DirectionNode = node.neighbors().nodeAt(inDirection);
    let nextNode: DirectionNode = thisNode.neighbors().nodeAt(inDirection);
    while (nextNode) {
      total += thisNode.neighbors().separationAt(inDirection) * scale;
      scale *= thisNode.neighbors().nodeAt(inDirection).scale();

      thisNode = nextNode;
      nextNode = nextNode.neighbors().nodeAt(inDirection);
    }
  }

  return total;
};
