import { comesBefore } from "./comesBefore";
import { DirectionNode } from "..";

/**
 * Returns true if the given other node comes after this node in layout order.
 *
 * @param {DirectionNode} node - the subject DirectionNode.
 * @param {DirectionNode} other - the object DirectionNode.
 * @return {boolean} true if this node comes after the given node.
 *
 * @see {@link comesBefore}
 */
export const comesAfter = (
  node: DirectionNode,
  other: DirectionNode
): boolean => {
  if (node === other) {
    return false;
  }
  return !comesBefore(node, other);
};
