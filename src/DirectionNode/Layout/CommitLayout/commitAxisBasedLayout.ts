import {
  Direction,
  Axis,
  getPerpendicularAxis,
  reverseDirection,
} from "../../../Direction";

import { DirectionNode, PreferredAxis } from "../..";

import { layoutAxis } from "..";

import { LayoutPainter } from "./LayoutPainter";
import { layoutSingle } from "./layoutSingle";
import { Size } from "../../../Size";

export const commitAxisBasedLayout = (
  painter: LayoutPainter,
  node: DirectionNode,
  lineThickness: number,
  bodySize: Size
): boolean => {
  // Layout based upon the axis preference.
  if (
    node.siblings().canonicalLayoutPreference() == PreferredAxis.PERPENDICULAR
  ) {
    const firstAxis: Axis = getPerpendicularAxis(
      node.neighbors().parentDirection()
    );

    // Check for nodes perpendicular to parent's direction
    const hasFirstAxisNodes: [Direction, Direction] = node
      .neighbors()
      .hasNodes(firstAxis);
    const oppositeFromParent: Direction = reverseDirection(
      node.neighbors().parentDirection()
    );
    if (
      layoutAxis(
        painter,
        node,
        hasFirstAxisNodes[0],
        hasFirstAxisNodes[1],
        false,
        lineThickness,
        bodySize
      )
    ) {
      return true;
    }

    // Layout this node's second-axis child, if that child exists.
    if (node.neighbors().hasNode(oppositeFromParent)) {
      // Layout the second-axis child.
      if (
        layoutSingle(
          node,
          oppositeFromParent,
          true,
          lineThickness,
          bodySize,
          painter
        )
      ) {
        return true;
      }
    }
  } else {
    // Layout this node's second-axis child, if that child exists.
    const oppositeFromParent: Direction = reverseDirection(
      node.neighbors().parentDirection()
    );

    // Check for nodes perpendicular to parent's direction
    const perpendicularNodes: [Direction, Direction] = node
      .neighbors()
      .hasNodes(getPerpendicularAxis(node.neighbors().parentDirection()));

    if (node.neighbors().hasNode(oppositeFromParent)) {
      // Layout the second-axis child.
      if (
        layoutSingle(
          node,
          oppositeFromParent,
          perpendicularNodes[0] === Direction.NULL &&
            perpendicularNodes[1] === Direction.NULL,
          lineThickness,
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
        lineThickness,
        bodySize
      )
    ) {
      return true;
    }
  }

  return false;
};
