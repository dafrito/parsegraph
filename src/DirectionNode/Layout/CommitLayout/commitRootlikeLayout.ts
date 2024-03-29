import { Direction } from "../../../Direction";

import { DirectionNode, PreferredAxis } from "../..";

import { LayoutPainter } from "./LayoutPainter";
import { layoutAxis } from "./layoutAxis";

export const commitRootlikeLayout = (
  painter: LayoutPainter,
  node: DirectionNode,
  bodySize: number[]
): boolean => {
  if (
    node.siblings().getLayoutPreference() === PreferredAxis.HORIZONTAL ||
    node.siblings().getLayoutPreference() === PreferredAxis.PERPENDICULAR
  ) {
    // Root-like, so just lay out both axes.
    if (
      layoutAxis(
        painter,
        node,
        Direction.BACKWARD,
        Direction.FORWARD,
        !node.neighbors().hasNode(Direction.UPWARD) &&
          !node.neighbors().hasNode(Direction.DOWNWARD),
        bodySize
      )
    ) {
      return true;
    }

    // This node is root-like, so it lays out the second-axis children in
    // the same method as the first axis.
    if (
      layoutAxis(
        painter,
        node,
        Direction.UPWARD,
        Direction.DOWNWARD,
        true,
        bodySize
      )
    ) {
      return true;
    }
  } else {
    // Root-like, so just lay out both axes.
    if (
      layoutAxis(
        painter,
        node,
        Direction.UPWARD,
        Direction.DOWNWARD,
        !node.neighbors().hasNode(Direction.BACKWARD) &&
          !node.neighbors().hasNode(Direction.FORWARD),
        bodySize
      )
    ) {
      return true;
    }

    // This node is root-like, so it lays out the second-axis children in
    // the same method as the first axis.
    if (
      layoutAxis(
        painter,
        node,
        Direction.BACKWARD,
        Direction.FORWARD,
        true,
        bodySize
      )
    ) {
      return true;
    }
  }

  return false;
};
