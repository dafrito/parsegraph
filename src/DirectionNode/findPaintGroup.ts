import { DirectionNode } from "./DirectionNode";

/**
 * Finds the paint group root.
 *
 * This iterates up the parent neighbors until a paint group root is
 * found. If none is found, then the root is used.
 *
 * @param {DirectionNode} origin - the node that starts the search
 * @return {DirectionNode} the paint group root
 */
export const findPaintGroup = (origin: DirectionNode): DirectionNode => {
  if (!origin.paintGroups().paintGroupNode()) {
    let node: DirectionNode = origin;
    while (!node.neighbors().isRoot()) {
      if (node.paintGroups().isPaintGroup()) {
        break;
      }
      if (node.paintGroups().paintGroupNode()) {
        origin.paintGroups().setPaintGroupNode(node.paintGroups().paintGroupNode());
        return origin.paintGroups().paintGroupNode();
      }
      node = node.neighbors().parentNode();
    }
    origin.paintGroups().setPaintGroupNode(node);
  }
  return origin.paintGroups().paintGroupNode();
};
