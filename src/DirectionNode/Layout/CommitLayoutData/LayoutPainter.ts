import { Direction, Axis } from "../../../Direction";
import { DirectionNode } from "../../DirectionNode";
import { Size } from "../../../Size";

export interface LayoutPainter {
  size(node: DirectionNode, bodySize: Size): void;
  getSeparation(
    node: DirectionNode,
    axis: Axis,
    dir: Direction,
    preferVertical: boolean
  ): number;
  paint(pg: DirectionNode): boolean;
}
