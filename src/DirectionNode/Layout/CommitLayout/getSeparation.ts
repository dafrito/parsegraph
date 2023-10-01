import { Direction, Axis } from "../../../Direction";

import { DirectionNode } from "../..";
import { LayoutPainter } from "./LayoutPainter";

export const getSeparation = (
  painter: LayoutPainter,
  node: DirectionNode,
  axis: Axis,
  dir: Direction,
  preferVertical: boolean
): number => {
  const getSeparation = painter.getSeparation;
  if (!getSeparation) {
    return 0;
  }
  return getSeparation(node, axis, dir, preferVertical);
};
