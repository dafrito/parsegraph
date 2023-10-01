import { DirectionNode } from "./DirectionNode";

/**
 * Finds the paint group root.
 *
 * This iterates up the parent neighbors until a paint group root is
 * found. If none is found, then the root is used.
 *
 * @return {DirectionNode} the paint group root
 */
export const findPaintGroup = (origin: DirectionNode): DirectionNode => {
  if (!origin.paintGroupNode()) {
    let node: DirectionNode = origin;
    while (!node.neighbors().isRoot()) {
      if (node.isPaintGroup()) {
        break;
      }
      if (node.paintGroupNode()) {
        origin.setpaintGroupNode(node.paintGroupNode());
        return origin.paintGroupNode();
      }
      node = node.parentNode();
    }
    origin.setpaintGroupNode(node);
  }
  return origin.paintGroupNode();
};
