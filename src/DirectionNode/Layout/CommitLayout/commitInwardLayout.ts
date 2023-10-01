import { Extent } from "../Extent";

import {
  Direction,
  Axis,
  getPerpendicularAxis,
  getPositiveDirection,
  getNegativeDirection,
  getDirectionAxis,
  reverseDirection,
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

import { BaseCommitLayout } from "./BaseCommitLayout";
import { LayoutPainter } from "./LayoutPainter";
import { findConsecutiveLength } from "./findConsecutiveLength";
import { combineExtents } from "./CombineExtents";
import { AddLineBounds } from "./AddLineBounds";
import { positionChild } from "./positionChild";
import { getAlignment } from "./getAlignment";
import { layoutSingle } from "./LayoutSingle";
import { Size } from "../../../Size";

const getSeparation = (painter: LayoutPainter, node: DirectionNode, axis: Axis, dir: Direction, preferVertical: boolean): number => {
  const getSeparation = painter.getSeparation;
  if (!getSeparation) {
    return 0;
  }
  return getSeparation(
    node,
    axis,
    dir,
    preferVertical
  );
};

export const commitInwardLayout = (painter: LayoutPainter, node: DirectionNode, bodySize: Size, firstSize: Size): boolean => {
  if (!node.neighbors().hasNode(Direction.INWARD)) {
    return false;
  }
  const nestedNode: DirectionNode = node.neighbors().nodeAt(Direction.INWARD);
  if (nestedNode.layout().phase() !== LayoutPhase.COMMITTED) {
    node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
    return true;
  }
  nestedNode.layout().extentSize(firstSize);
  const nestedSize = firstSize;
  if (
    node.neighbors().getAlignment(Direction.INWARD) ===
    Alignment.INWARD_VERTICAL
  ) {
    node
      .neighbors()
      .setPosAt(
        Direction.INWARD,
        nestedNode.scale() *
          (nestedNode.layout().extentOffsetAt(Direction.DOWNWARD) -
            nestedSize[0] / 2),
        bodySize[1] / 2 -
          getSeparation(painter, node, Axis.Z, Direction.INWARD, true) /
            2 +
          nestedNode.scale() *
            (-nestedSize[1] +
              nestedNode.layout().extentOffsetAt(Direction.FORWARD))
      );
  } else {
    // console.log(this.horizontalPadding(), this.borderThickness());
    node
      .neighbors()
      .setPosAt(
        Direction.INWARD,
        bodySize[0] / 2 -
          getSeparation(
            painter,
            node,
            Axis.Z,
            Direction.INWARD,
            false
          ) /
            2 +
          nestedNode.scale() *
            (-nestedSize[0] +
              nestedNode.layout().extentOffsetAt(Direction.DOWNWARD)),
        nestedNode.scale() *
          (nestedNode.layout().extentOffsetAt(Direction.FORWARD) -
            nestedSize[1] / 2)
      );
  }

  return false;
};
