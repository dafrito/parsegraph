import Direction, { Axis, DirectionNode } from "./direction";
import Size from "./size";

export default interface LayoutPainter {
  size(node: DirectionNode, bodySize: Size): void;
  getSeparation(
    node: DirectionNode,
    axis: Axis,
    dir: Direction,
    preferVertical: boolean
  ): number;
  paint(pg: DirectionNode): boolean;
}
