import { Extent } from "../Extent";

import {
  Direction,
 } from "../../../Direction";

import {
  Alignment,
  DirectionNode,
  Fit,
} from "../..";

import createException, {
  BAD_NODE_DIRECTION,
} from "../../../Exception";

const bv = [NaN, NaN, NaN];

export const combineExtent = (
  node: DirectionNode,
  childDirection: Direction,
  direction: Direction,
  lengthAdjustment: number,
  sizeAdjustment: number
): void => {
  /* console.log(
              "combineExtent(" +
              nameDirection(direction) + ", " +
              lengthAdjustment + ", " +
              sizeAdjustment + ")"
          );*/
  // Calculate the new offset to this node's center.
  const child = node.neighbors().nodeAt(childDirection);
  const lengthOffset =
    node.layout().extentOffsetAt(direction) +
    lengthAdjustment -
    node.neighbors().nodeAt(childDirection).scale() *
      child.layout().extentOffsetAt(direction);

  // Combine the two extents in the given direction.
  /* console.log("Combining " + nameDirection(direction) + ", " );
          console.log("Child: " + nameLayoutPhase(child.layout().phase()));
          console.log("Length offset: " + lengthOffset);
          console.log("Size adjustment: " + sizeAdjustment);
          console.log("ExtentOffset : " +
            node.neighbors().at(direction).extentOffset);
          console.log("Scaled child ExtentOffset : " +
          (node.neighbors().nodeAt(childDirection).scale() * child.extentOffsetAt(direction))); */
  const e: Extent = node.layout().extentsAt(direction);
  const scale: number = node.neighbors().nodeAt(childDirection).scale();
  if (node.nodeFit() == Fit.LOOSE) {
    e.combineExtentAndSimplify(
      child.layout().extentsAt(direction),
      lengthOffset,
      sizeAdjustment,
      scale,
      bv
    );
  } else {
    e.combineExtent(
      child.layout().extentsAt(direction),
      lengthOffset,
      sizeAdjustment,
      scale
    );
  }

  // Adjust the length offset to remain positive.
  if (lengthOffset < 0) {
    // console.log("Adjusting negative extent offset.");
    node
      .layout()
      .setExtentOffsetAt(
        direction,
        node.layout().extentOffsetAt(direction) + Math.abs(lengthOffset)
      );
  }

  /* console.log(
              "New "
              + nameDirection(direction)
              + " extent offset = "
              + this.extentOffsetAt(direction)
          );
          this.extentsAt(direction).forEach(function(l, s, i) {
              console.log(i + ". length=" + l + ", size=" + s);
          });*/

  // Assert the extent offset is positive.
  if (node.layout().extentOffsetAt(direction) < 0) {
    throw new Error("Extent offset must not be negative.");
  }
};

/**
 * Merge this node's extents in the given direction with the
 * child's extents.
 *
 * alignment is the offset of the child from this node.
 * Positive values indicate presence in the positive
 * direction. (i.e. forward or upward).
 *
 * separation is the distance from the center of this node to the center
 * of the node in the specified direction.
 *
 * @param {DirectionNode} node the node to work with
 * @param {Direction} childDirection the direction used for combining extents
 * @param {Alignment} alignment the alignment in the given direction
 * @param {number} separation the separation between nodes
 */
export const combineExtents = (
  node: DirectionNode,
  childDirection: Direction,
  alignment: Alignment,
  separation: number
): void => {
  // Combine an extent.
  // lengthAdjustment and sizeAdjustment are in this node's space.

  switch (childDirection) {
    case Direction.DOWNWARD:
      // Downward child.
      combineExtent(
        node,
        childDirection,
        Direction.DOWNWARD,
        alignment,
        separation
      );
      combineExtent(
        node,
        childDirection,
        Direction.UPWARD,
        alignment,
        -separation
      );

      combineExtent(
        node,
        childDirection,
        Direction.FORWARD,
        separation,
        alignment
      );
      combineExtent(
        node,
        childDirection,
        Direction.BACKWARD,
        separation,
        -alignment
      );
      break;
    case Direction.UPWARD:
      // Upward child.
      combineExtent(
        node,
        childDirection,
        Direction.DOWNWARD,
        alignment,
        -separation
      );
      combineExtent(
        node,
        childDirection,
        Direction.UPWARD,
        alignment,
        separation
      );

      combineExtent(
        node,
        childDirection,
        Direction.FORWARD,
        -separation,
        alignment
      );
      combineExtent(
        node,
        childDirection,
        Direction.BACKWARD,
        -separation,
        -alignment
      );
      break;
    case Direction.FORWARD:
      // Forward child.
      combineExtent(
        node,
        childDirection,
        Direction.DOWNWARD,
        separation,
        alignment
      );
      combineExtent(
        node,
        childDirection,
        Direction.UPWARD,
        separation,
        -alignment
      );

      combineExtent(
        node,
        childDirection,
        Direction.FORWARD,
        alignment,
        separation
      );
      combineExtent(
        node,
        childDirection,
        Direction.BACKWARD,
        alignment,
        -separation
      );
      break;
    case Direction.BACKWARD:
      // Backward child.
      combineExtent(
        node,
        childDirection,
        Direction.DOWNWARD,
        -separation,
        alignment
      );
      combineExtent(
        node,
        childDirection,
        Direction.UPWARD,
        -separation,
        -alignment
      );

      combineExtent(
        node,
        childDirection,
        Direction.FORWARD,
        alignment,
        -separation
      );
      combineExtent(
        node,
        childDirection,
        Direction.BACKWARD,
        alignment,
        separation
      );
      break;
    default:
      throw createException(BAD_NODE_DIRECTION);
  }
}