import { Extent } from "../Extent";

import {
  Direction,
  Axis,
  getDirectionAxis,
  reverseDirection,
} from "../../../Direction";

import { DirectionNode, AxisOverlap } from "../..";

import { LayoutPhase } from "..";

import { LayoutPainter } from "./LayoutPainter";
import { combineExtents } from "./combineExtents";
import { positionChild } from "./positionChild";
import { getAlignment } from "./getAlignment";
import { getSeparation } from "./getSeparation";

const firstSize: number[] = [NaN, NaN];

// Layout a single node in the given direction.
export const layoutSingle = (
  node: DirectionNode,
  direction: Direction,
  allowAxisOverlap: boolean,
  bodySize: number[],
  painter: LayoutPainter
): boolean => {
  if (!node.neighbors().hasNode(direction)) {
    return false;
  }

  switch (node.neighbors().axisOverlap(direction)) {
    case AxisOverlap.PREVENTED:
      allowAxisOverlap = false;
      break;
    case AxisOverlap.ALLOWED:
      allowAxisOverlap = true;
      break;
  }

  /* console.log(
            "Laying out single " + nameDirection(direction) + " child, "
            + (allowAxisOverlap ? "with " : "without ") + "axis overlap."
        );*/

  // Get the alignment for the children.
  const alignment: number = getAlignment(node, direction);
  // console.log("Calculated alignment of " + alignment + ".");

  const child: DirectionNode = node.neighbors().nodeAt(direction);
  const reversed: Direction = reverseDirection(direction);
  const childExtent: Extent = child.layout().extentsAt(reversed);

  if (child.layout().phase() !== LayoutPhase.COMMITTED) {
    node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
    // console.log(Node.getLayoutNodes(findPaintGroup(child)));
    // console.log(namePreferredAxis(child.getLayoutPreference()));
    // console.log("Child's paint group is dirty: " +
    //   findPaintGroup(child).isDirty());
    // console.log(nameDirection(direction) + " Child " +
    //   nameType(child.type()) + " " + (child.id()) +
    //   " does not have a committed layout.
    //   Child's layout state is " +
    //   nameLayoutPhase(child.layout().phase()), child);
    return true;
  }

  // Separate the child from this node.

  let separationFromChild: number = node
    .layout()
    .extentsAt(direction)
    .separation(
      childExtent,
      node.layout().extentOffsetAt(direction) +
        alignment -
        node.neighbors().nodeAt(direction).scale() *
          child.layout().extentOffsetAt(reversed),
      allowAxisOverlap,
      node.neighbors().nodeAt(direction).scale()
    );
  // console.log("Calculated unpadded separation of " +
  //   separationFromChild + ".");

  // Add padding and ensure the child is not separated less than
  // it would be if the node was not offset by alignment.
  child.layout().size(firstSize);

  if (getDirectionAxis(direction) == Axis.VERTICAL) {
    separationFromChild = Math.max(
      separationFromChild,
      node.neighbors().nodeAt(direction).scale() * (firstSize[1] / 2) +
        bodySize[1] / 2
    );
    separationFromChild +=
      getSeparation(painter, node, Axis.VERTICAL, direction, true) *
      node.neighbors().nodeAt(direction).scale();
  } else {
    separationFromChild = Math.max(
      separationFromChild,
      node.neighbors().nodeAt(direction).scale() * (firstSize[0] / 2) +
        bodySize[0] / 2
    );
    separationFromChild +=
      getSeparation(painter, node, Axis.HORIZONTAL, direction, false) *
      node.neighbors().nodeAt(direction).scale();
  }
  // console.log("Calculated padded separation of " +
  //   separationFromChild + ".");

  // Set the node's position.
  positionChild(node, direction, alignment, separationFromChild);

  // Combine the extents of the child and this node.
  combineExtents(node, direction, alignment, separationFromChild);

  return false;
};
