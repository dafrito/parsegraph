import { Direction, Axis } from "../../../Direction";
import { DirectionNode } from "../../DirectionNode";
import { Size } from "../../../Size";

/**
 * Provides sizing information for {@link DirectionNode} graphs and can paint
 * during {@link CommitLayout} commits.
 */
export interface LayoutPainter {
  /**
   * Computes the size for the given {@link DirectionNode} and its value.
   *
   * @param {DirectionNode} node - the node to be sized
   * @param {Size} bodySize - the destination for the computed size
   */
  size(node: DirectionNode, bodySize: Size): void;

  /**
   * Calculates the minimum separation between a node and the neighbor
   * on the given direction, according to the given Axis.
   *
   * @param {DirectionNode} node
   * @param {Axis} axis
   * @param {Direction} dir
   * @param {boolean} preferVertical
   *
   * @return {number} the minimum separation
   */
  getSeparation?: (
    node: DirectionNode,
    axis: Axis,
    dir: Direction,
    preferVertical: boolean
  ) => number;

  /**
   * Optional. Paints the nodes of a newly committed paint group.
   *
   * This can be used to pre-render a paint group.
   *
   * @param {DirectionNode} pg - the paint group to paint
   *
   * @return {boolean} true if painting needs another call, false if done
   */
  paint?: (pg: DirectionNode) => boolean;
}
