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

export class AddLineBounds {
  private lineBounds: [number, number];

  constructor() {
    this.lineBounds = [NaN, NaN];
  }
  private sizeIn(
    node: DirectionNode,
    direction: Direction,
    bodySize: Size
  ): number {
    node.layout().size(bodySize);
    if (isVerticalDirection(direction)) {
      return bodySize[1] / 2;
    } else {
      return bodySize[0] / 2;
    }
  }

  addLineBounds(node: DirectionNode, given: Direction, bodySize: Size) {
    if (!node.neighbors().hasChild(given)) {
      return;
    }

    const perpAxis: Axis = getPerpendicularAxis(given);
    const dirSign: number = directionSign(given);

    let positiveOffset: number = node
      .layout()
      .extentOffsetAt(getPositiveDirection(perpAxis));
    let negativeOffset: number = node
      .layout()
      .extentOffsetAt(getNegativeDirection(perpAxis));

    if (dirSign < 0) {
      const lineSize: number = this.sizeIn(node, given, this.lineBounds);
      positiveOffset -= lineSize + node.neighbors().lineLengthAt(given);
      negativeOffset -= lineSize + node.neighbors().lineLengthAt(given);
    }

    if (node.nodeFit() == Fit.EXACT) {
      // Append the line-shaped bound.
      let lineSize: number;
      if (perpAxis === Axis.VERTICAL) {
        lineSize = bodySize[1] / 2;
      } else {
        lineSize = bodySize[0] / 2;
      }
      // lineSize = this.neighbors().nodeAt(given).scale() * LINE_THICKNESS / 2;
      node
        .layout()
        .extentsAt(getPositiveDirection(perpAxis))
        .combineBound(
          positiveOffset,
          node.neighbors().lineLengthAt(given),
          lineSize
        );
      node
        .layout()
        .extentsAt(getNegativeDirection(perpAxis))
        .combineBound(
          negativeOffset,
          node.neighbors().lineLengthAt(given),
          lineSize
        );
    }
  }
}