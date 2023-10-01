import { DirectionNode } from "../../DirectionNode";
import { Direction, isCardinalDirection, getDirectionAxis, Axis } from "../../../Direction";
import createException, { BAD_NODE_DIRECTION } from "../../../Exception";

export const findConsecutiveLength = (node: DirectionNode, inDirection: Direction): number => {
  // Exclude some directions that cannot be calculated.
  if (!isCardinalDirection(inDirection)) {
    throw createException(BAD_NODE_DIRECTION);
  }

  const directionAxis: Axis = getDirectionAxis(inDirection);
  if (directionAxis === Axis.NULL) {
    // This should be impossible.
    throw createException(BAD_NODE_DIRECTION);
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
}