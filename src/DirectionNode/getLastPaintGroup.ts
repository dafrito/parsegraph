import { DirectionNode } from "./DirectionNode";
import makeLimit from "./makeLimit";

/**
 * Finds the last paint group to be painted and rendered
that is still a descendent of this node.
  *
  * @param {DirectionNode} node - the root node
  * @return {DirectionNode} The first paint group to be drawn that is a child of this paint group.
  */
export const getLastPaintGroup = (node: DirectionNode): DirectionNode => {
  let candidate: DirectionNode = node.isPaintGroup()
    ? node.paintGroup().next()
    : node;
  const lim = makeLimit();
  while (candidate !== node) {
    if (!candidate.neighbors().hasAncestor(node)) {
      const rv = candidate.paintGroup().prev();
      return rv;
    }
    candidate = candidate.paintGroup().next();
    lim();
  }
  return candidate === node ? candidate.paintGroup().prev() : candidate;
};
