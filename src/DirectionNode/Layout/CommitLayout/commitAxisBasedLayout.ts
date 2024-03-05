import {
  Direction,
  Axis,
  getPerpendicularAxis,
  reverseDirection,
} from "../../../Direction";

import { DirectionNode, PreferredAxis } from "../..";

import { layoutAxis } from "./layoutAxis";

import { LayoutPainter } from "./LayoutPainter";
import { layoutSingle } from "./layoutSingle";

const getParentDirection = (node: DirectionNode) => {
  if (node.neighbors().isRoot()) {
    throw new Error("Node is root and has no parent direction");
  }
  const parentDir = node.neighbors().parentDirection();
  if (undefined === parentDir) {
    throw new Error("A non-root node must have a parent direction");
  }
  return parentDir;
};

export const commitAxisBasedLayout = (
  painter: LayoutPainter,
  node: DirectionNode,
  bodySize: number[]
): boolean => {
  // Layout based upon the axis preference.
  if (
    node.siblings().canonicalLayoutPreference() == PreferredAxis.PERPENDICULAR
  ) {
    const firstAxis: Axis = getPerpendicularAxis(getParentDirection(node));

    // Check for nodes perpendicular to parent's direction
    const hasFirstAxisNodes: [Direction | undefined, Direction | undefined] =
      node.neighbors().hasNodes(firstAxis);
    const oppositeFromParent: Direction = reverseDirection(
      getParentDirection(node)
    );
    if (
      layoutAxis(
        painter,
        node,
        hasFirstAxisNodes[0],
        hasFirstAxisNodes[1],
        false,
        bodySize
      )
    ) {
      return true;
    }

    // Layout this node's second-axis child, if that child exists.
    if (node.neighbors().hasNode(oppositeFromParent)) {
      // Layout the second-axis child.
      if (layoutSingle(node, oppositeFromParent, true, bodySize, painter)) {
        return true;
      }
    }
  } else {
    // Layout this node's second-axis child, if that child exists.
    const oppositeFromParent: Direction = reverseDirection(
      getParentDirection(node)
    );

    // Check for nodes perpendicular to parent's direction
    const perpendicularNodes: [Direction | undefined, Direction | undefined] =
      node.neighbors().hasNodes(getPerpendicularAxis(getParentDirection(node)));

    if (node.neighbors().hasNode(oppositeFromParent)) {
      // Layout the second-axis child.
      if (
        layoutSingle(
          node,
          oppositeFromParent,
          perpendicularNodes[0] === undefined &&
            perpendicularNodes[1] === undefined,
          bodySize,
          painter
        )
      ) {
        return true;
      }
    }

    if (
      layoutAxis(
        painter,
        node,
        perpendicularNodes[0],
        perpendicularNodes[1],
        true,
        bodySize
      )
    ) {
      return true;
    }
  }

  return false;
};
