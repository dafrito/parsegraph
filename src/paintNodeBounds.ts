import { DirectionNode } from "./DirectionNode";
import { BoundsPainter } from "./paintNodeLines";

const size = [NaN, NaN];

/**
 * Calls the given painter once for the given node. The painter will be called
 * with the following arguments:
 * 
 * painter(x, y, w, h);
 * where x and y are the node's group position, and w and h are its group size.
 * 
 * @param {DirectionNode} node the node to paint
 * @param {BoundsPainter} painter the painter that will be called with the node's dimensions
 */
export function paintNodeBounds(node: DirectionNode, painter: BoundsPainter) {
  if (arguments.length !== 2 || !(node instanceof DirectionNode) || typeof painter !== "function") {
    throw new Error("Usage: paintNodeBounds(node, painter)");
  }
  const layout = node.layout();
  layout.groupSize(size);
  const x = layout.groupX();
  const y = layout.groupY();
  const w = size[0];
  const h = size[1];
  painter(x, y, w, h);
}
