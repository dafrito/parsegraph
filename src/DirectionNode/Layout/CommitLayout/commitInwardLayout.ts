import {
  Direction,
  Axis,
} from "../../../Direction";

import {
  Alignment,
  DirectionNode,
} from "../..";

import { LayoutPhase } from "..";

import { LayoutPainter } from "./LayoutPainter";
import { Size } from "../../../Size";
import { getSeparation } from "./getSeparation";

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
