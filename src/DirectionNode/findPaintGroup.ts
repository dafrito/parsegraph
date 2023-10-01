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
  if (!origin.paintGroupRoot()) {
    let node: DirectionNode = origin;
    while (!node.neighbors().isRoot()) {
      if (node.localPaintGroup()) {
        break;
      }
      if (node.paintGroupRoot()) {
        origin.setPaintGroupRoot(node.paintGroupRoot());
        return origin.paintGroupRoot();
      }
      node = node.parentNode();
    }
    origin.setPaintGroupRoot(node);
  }
  return origin.paintGroupRoot();
};
