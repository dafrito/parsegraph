import {
  Direction,
  getPerpendicularAxis,
  getPositiveDirection,
  getNegativeDirection,
  getDirectionAxis,
} from "../../../Direction";

import { Alignment, DirectionNode } from "../..";

import createException, { BAD_NODE_ALIGNMENT } from "../../../Exception";

import { findConsecutiveLength } from "./findConsecutiveLength";

/**
 * Returns the offset of the child's center in the given direction from
 * this node's center.
 *
 * This offset is in a direction perpendicular to the given direction
 * and is positive to indicate a negative offset.
 *
 * The result is in this node's space.
 *
 * @param {DirectionNode} node the node to retrieve alignment offset
 * @param {Direction} childDirection the direction where alignment offset is retrieved
 * @return {number} the alignment offset
 */
export const getAlignment = (
  node: DirectionNode,
  childDirection: Direction
): number => {
  // Calculate the alignment adjustment for both nodes.
  const child = node.neighbors().nodeAt(childDirection);
  const axis = getPerpendicularAxis(getDirectionAxis(childDirection));

  let rv;

  const alignmentMode = node.neighbors().getAlignment(childDirection);
  switch (alignmentMode) {
    case Alignment.NULL:
      throw createException(BAD_NODE_ALIGNMENT);
    case Alignment.NONE:
      // Unaligned nodes have no alignment offset.
      rv = 0;
      break;
    case Alignment.NEGATIVE:
      rv = findConsecutiveLength(child, getNegativeDirection(axis));
      break;
    case Alignment.CENTER: {
      const negativeLength: number = findConsecutiveLength(
        child,
        getNegativeDirection(axis)
      );

      const positiveLength: number = findConsecutiveLength(
        child,
        getPositiveDirection(axis)
      );

      const halfLength: number = (negativeLength + positiveLength) / 2;

      if (negativeLength > positiveLength) {
        // The child's negative neighbors extend
        // more than their positive neighbors.
        rv = negativeLength - halfLength;
      } else if (negativeLength < positiveLength) {
        rv = -(positiveLength - halfLength);
      } else {
        rv = 0;
      }
      break;
    }
    case Alignment.POSITIVE:
      rv = -findConsecutiveLength(child, getPositiveDirection(axis));
      break;
  }
  return rv * node.neighbors().nodeAt(childDirection).scale();
};
