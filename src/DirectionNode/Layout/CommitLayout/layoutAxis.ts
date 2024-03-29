import { Direction, Axis, getDirectionAxis } from "../../../Direction";

import { DirectionNode, AxisOverlap } from "../..";

import { LayoutPhase } from "..";

import { LayoutPainter } from "./LayoutPainter";
import { combineExtents } from "./combineExtents";
import { positionChild } from "./positionChild";
import { getAlignment } from "./getAlignment";
import { layoutSingle } from "./layoutSingle";
import { getSeparation } from "./getSeparation";

const firstSize: number[] = [NaN, NaN];
const secondSize: number[] = [NaN, NaN];

/**
 * Layout a pair of nodes in the given directions.
 *
 * The child nodes must have already been laid out.
 *
 * @param {LayoutPainter} painter - the layout painter to use for this layout
 * @param {DirectionNode} node - the parent node being laid out
 * @param {Direction} firstDirection - the first direction to lay out
 * @param {Direction} secondDirection - the second direction to lay out
 * @param {boolean} allowAxisOverlap - whether the child can overlap the parent's axis.
 * @param {Size} bodySize - the size of the node
 * @return {boolean} true if another call is needed, false if done
 */
export const layoutAxis = (
  painter: LayoutPainter,
  node: DirectionNode,
  firstDirection: Direction | undefined,
  secondDirection: Direction | undefined,
  allowAxisOverlap: boolean,
  bodySize: number[]
): boolean => {
  if (firstDirection === secondDirection && firstDirection !== undefined) {
    throw new Error(
      "First and second directions cannot be the same unless they are both null"
    );
  }
  // Change the node direction to null if there is no node in that
  // direction.
  if (
    firstDirection !== undefined &&
    !node.neighbors().hasNode(firstDirection)
  ) {
    firstDirection = undefined;
  }
  if (
    secondDirection !== undefined &&
    !node.neighbors().hasNode(secondDirection)
  ) {
    secondDirection = undefined;
  }

  // Return if there are no directions.
  if (firstDirection === undefined && secondDirection === undefined) {
    return false;
  }

  // Test if this node has a first-axis child in only one direction.
  if (firstDirection === undefined || secondDirection === undefined) {
    // Find the direction of the only first-axis child.
    let firstAxisDirection: Direction;
    if (firstDirection !== undefined) {
      firstAxisDirection = firstDirection;
    } else {
      // It must be the second direction.
      if (secondDirection === undefined) {
        throw new Error(
          "secondDirection for layout must be defined if firstDirection is undefined"
        );
      }
      firstAxisDirection = secondDirection;
    }

    // Layout that node.
    if (
      layoutSingle(
        node,
        firstAxisDirection,
        allowAxisOverlap,
        bodySize,
        painter
      )
    ) {
      node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
      return true;
    }
    return false;
  }

  /* console.log(
            "Laying out " +
            nameDirection(firstDirection) + " and " +
            nameDirection(secondDirection) + " children."
        );*/

  // This node has first-axis children in both directions.
  const firstNode: DirectionNode = node.neighbors().nodeAt(firstDirection);
  const secondNode: DirectionNode = node.neighbors().nodeAt(secondDirection);

  // Get the alignments for the children.
  const firstNodeAlignment: number = getAlignment(node, firstDirection);
  const secondNodeAlignment: number = getAlignment(node, secondDirection);
  // console.log("First alignment: " + firstNodeAlignment);
  // console.log("Second alignment: " + secondNodeAlignment);

  let separationBetweenChildren: number = firstNode
    .layout()
    .extentsAt(secondDirection)
    .separation(
      secondNode.layout().extentsAt(firstDirection),
      (node.neighbors().nodeAt(secondDirection).scale() /
        node.neighbors().nodeAt(firstDirection).scale()) *
        (secondNodeAlignment -
          secondNode.layout().extentOffsetAt(firstDirection)) -
        (firstNodeAlignment -
          firstNode.layout().extentOffsetAt(secondDirection)),
      true,
      node.neighbors().nodeAt(secondDirection).scale() /
        node.neighbors().nodeAt(firstDirection).scale()
    );
  separationBetweenChildren *= node.neighbors().nodeAt(firstDirection).scale();

  // console.log("Separation between children="
  //   + separationBetweenChildren);

  /*
        var firstExtent = this.extentsAt(firstDirection);
        console.log(
            "This " +
            nameDirection(firstDirection) +
            " extent (offset to center=" +
            this.extentOffsetAt(firstDirection) +
            ")"
        );
        firstExtent.forEach(
            function(length, size, i) {
                console.log(i + ". l=" + length + ", s=" + size);
            }
        );

        console.log(
            nameDirection(firstDirection) +
            " " + nameType(this.neighbors().nodeAt(firstDirection).type()) +
            "'s " + nameDirection(secondDirection) +
            " extent (offset to center=" +
            this.neighbors().nodeAt(firstDirection).extentOffsetAt(secondDirection) +
            ")"
        );
        this.neighbors().nodeAt(firstDirection).extentsAt(secondDirection).forEach(
            function(length, size, i) {
                console.log(i + ". l=" + length + ", s=" + size);
            }
        );

        console.log(
            "FirstNodeAlignment=" + firstNodeAlignment
        );
        console.log(
            "firstDirection extentOffset=" +
                this.extentOffsetAt(firstDirection)
        );
        console.log(
            "firstNode.extentOffsetAt(secondDirection)=" +
            firstNode.extentOffsetAt(secondDirection)
        );*/

  let firstAxisOverlap: boolean = allowAxisOverlap;
  switch (node.neighbors().nodeAt(firstDirection).neighbors().axisOverlap()) {
    case AxisOverlap.PREVENTED:
      firstAxisOverlap = false;
      break;
    case AxisOverlap.ALLOWED:
      firstAxisOverlap = true;
      break;
  }
  let secondAxisOverlap: boolean = allowAxisOverlap;
  switch (node.neighbors().nodeAt(secondDirection).neighbors().axisOverlap()) {
    case AxisOverlap.PREVENTED:
      secondAxisOverlap = false;
      break;
    case AxisOverlap.ALLOWED:
      secondAxisOverlap = true;
      break;
  }

  // Allow some overlap if we have both first-axis sides, but
  // nothing ahead on the second axis.
  let separationFromFirst: number = node
    .layout()
    .extentsAt(firstDirection)
    .separation(
      firstNode.layout().extentsAt(secondDirection),
      node.layout().extentOffsetAt(firstDirection) +
        firstNodeAlignment -
        node.neighbors().nodeAt(firstDirection).scale() *
          firstNode.layout().extentOffsetAt(secondDirection),
      firstAxisOverlap,
      node.neighbors().nodeAt(firstDirection).scale()
    );

  let separationFromSecond: number = node
    .layout()
    .extentsAt(secondDirection)
    .separation(
      secondNode.layout().extentsAt(firstDirection),
      node.layout().extentOffsetAt(secondDirection) +
        secondNodeAlignment -
        node.neighbors().nodeAt(secondDirection).scale() *
          secondNode.layout().extentOffsetAt(firstDirection),
      secondAxisOverlap,
      node.neighbors().nodeAt(secondDirection).scale()
    );

  /* console.log(
            "Separation from this " + nameType(this.type()) + " to " +
            nameDirection(firstDirection) + " " +
            nameType(this.neighbors().nodeAt(firstDirection).type()) + "=" +
            separationFromFirst
        );
        console.log(
            "Separation from this " + nameType(this.type()) + " to " +
            nameDirection(secondDirection) + " " +
            nameType(this.neighbors().nodeAt(secondDirection).type()) + "=" +
            separationFromSecond
        );*/

  // TODO Handle occlusion of the second axis if we have a parent or
  // if we have a second-axis child. Doesn't this code need to ensure
  // the second-axis child is not trapped inside too small a space?

  if (separationBetweenChildren >= separationFromFirst + separationFromSecond) {
    // The separation between the children is greater than the
    // separation between each child and this node.

    // Center them as much as possible.
    separationFromFirst = Math.max(
      separationFromFirst,
      separationBetweenChildren / 2
    );
    separationFromSecond = Math.max(
      separationFromSecond,
      separationBetweenChildren / 2
    );
  } else {
    // separationBetweenChildren
    //    < separationFromFirst + separationFromSecond
    // The separation between children is less than what this node
    // needs to separate each child from itself, so do nothing to
    // the separation values.
  }

  firstNode.layout().size(firstSize);
  secondNode.layout().size(secondSize);
  if (getDirectionAxis(firstDirection) === Axis.VERTICAL) {
    separationFromFirst = Math.max(
      separationFromFirst,
      node.neighbors().nodeAt(firstDirection).scale() * (firstSize[1] / 2) +
        bodySize[1] / 2
    );
    separationFromFirst +=
      getSeparation(painter, node, Axis.VERTICAL, firstDirection, true) *
      node.neighbors().nodeAt(firstDirection).scale();

    separationFromSecond = Math.max(
      separationFromSecond,
      node.neighbors().nodeAt(secondDirection).scale() * (secondSize[1] / 2) +
        bodySize[1] / 2
    );
    separationFromSecond +=
      getSeparation(painter, node, Axis.VERTICAL, secondDirection, true) *
      node.neighbors().nodeAt(secondDirection).scale();
  } else {
    separationFromFirst = Math.max(
      separationFromFirst,
      node.neighbors().nodeAt(firstDirection).scale() * (firstSize[0] / 2) +
        bodySize[0] / 2
    );
    separationFromFirst +=
      getSeparation(painter, node, Axis.HORIZONTAL, firstDirection, false) *
      node.neighbors().nodeAt(firstDirection).scale();

    separationFromSecond = Math.max(
      separationFromSecond,
      node.neighbors().nodeAt(secondDirection).scale() * (secondSize[0] / 2) +
        bodySize[0] / 2
    );
    separationFromSecond +=
      getSeparation(painter, node, Axis.HORIZONTAL, secondDirection, false) *
      node.neighbors().nodeAt(secondDirection).scale();
  }

  // Set the positions of the nodes.
  positionChild(node, firstDirection, firstNodeAlignment, separationFromFirst);
  positionChild(
    node,
    secondDirection,
    secondNodeAlignment,
    separationFromSecond
  );

  // Combine their extents.
  combineExtents(node, firstDirection, firstNodeAlignment, separationFromFirst);
  combineExtents(
    node,
    secondDirection,
    secondNodeAlignment,
    separationFromSecond
  );

  return false;
};
