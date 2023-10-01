import { Extent } from "../Extent";

import {
  Direction,
  Axis,
  getPerpendicularAxis,
  getPositiveDirection,
  getNegativeDirection,
  directionSign,
  getDirectionAxis,
  isCardinalDirection,
  reverseDirection,
  isVerticalDirection,
  forEachCardinalDirection,
} from "../../../Direction";

import {
  Alignment,
  DirectionNode,
  Fit,
  PreferredAxis,
  AxisOverlap,
} from "../..";

import createException, {
  BAD_NODE_DIRECTION,
  BAD_NODE_ALIGNMENT,
} from "../../../Exception";

import { LayoutPhase } from "..";

import { Size } from "../../../Size";

import { BaseCommitLayout } from "./BaseCommitLayout";
import { LayoutPainter } from "./LayoutPainter";
import { findConsecutiveLength } from "./findConsecutiveLength";
import { combineExtents } from "./CombineExtents";
import { AddLineBounds } from "./AddLineBounds";

  /**
   * Positions a child.
   *
   * The alignment is positive in the positive direction.
   *
   * The separation is positive in the direction of the child.
   *
   * These values should in this node's space.
   *
   * The child's position is in this node's space.
   *
   * @param {DirectionNode} node the node to position
   * @param {Direction} childDirection the direction to position
   * @param {Alignment} alignment the alignment used for the given direction
   * @param {number} separation the separation used for the given child
   */
const firstSize = [NaN, NaN];
export const positionChild = (
    node: DirectionNode,
    childDirection: Direction,
    alignment: Alignment,
    separation: number
): void => {
  // Validate arguments.
  if (separation < 0) {
    throw new Error("separation must always be positive.");
  }
  if (!isCardinalDirection(childDirection)) {
    throw createException(BAD_NODE_DIRECTION);
  }
  const child: DirectionNode = node.neighbors().nodeAt(childDirection);
  const reversedDirection: Direction = reverseDirection(childDirection);

  // Save alignment parameters.
  node.neighbors().at(childDirection).alignmentOffset = alignment;
  // console.log("Alignment = " + alignment);
  node.neighbors().at(childDirection).separation = separation;

  // Determine the line length.
  let extentSize: number;
  if (node.neighbors().getAlignment(childDirection) === Alignment.NONE) {
    child.layout().size(firstSize);
    if (isVerticalDirection(childDirection)) {
      extentSize = firstSize[1] / 2;
    } else {
      extentSize = firstSize[0] / 2;
    }
  } else {
    extentSize = child
      .layout()
      .extentsAt(reversedDirection)
      .sizeAt(
        child.layout().extentOffsetAt(reversedDirection) -
          alignment / node.neighbors().nodeAt(childDirection).scale()
      );
  }
  const lineLength =
    separation - node.neighbors().nodeAt(childDirection).scale() * extentSize;
  node.neighbors().at(childDirection).lineLength = lineLength;
  // console.log(
  //   "Line length: " + lineLength + ",
  //   separation: " + separation + ",
  //   extentSize: " + extentSize);

  // Set the position.
  const dirSign = directionSign(childDirection);
  if (isVerticalDirection(childDirection)) {
    // The child is positioned vertically.
    node
      .neighbors()
      .setPosAt(childDirection, alignment, dirSign * separation);
  } else {
    node
      .neighbors()
      .setPosAt(childDirection, dirSign * separation, alignment);
  }
  /* console.log(
            nameDirection(childDirection) + " " +
            nameType(child.type()) + "'s position set to (" +
            this.neighbors().at(childDirection).xPos + ", " +
            this.neighbors().at(childDirection).yPos + ")"
        );*/
};