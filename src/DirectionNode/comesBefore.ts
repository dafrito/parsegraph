import { reverseDirection } from "../Direction/functions";
import { DirectionNode } from "./DirectionNode";
import { pathToRoot } from "./pathToRoot";

/**
 * Returns true if the given other node comes before this node in layout order.
 *
 * @param {DirectionNode} given - other DirectionNode.
 * @return {boolean} true if this node comes before the given node.
 *
 * @see {@link comesAfter}
 */
export const comesBefore = (node: DirectionNode, other: DirectionNode): boolean => {
  if (node === other) {
    return false;
  }
  if (node.neighbors().isRoot()) {
    // Root comes before all nodes.
    return true;
  }
  if (other.neighbors().isRoot()) {
    // If we are not root, but other is, then other
    // is assumed to come after us.
    return false;
  }

    const nodePath = pathToRoot(node).reverse();
    const otherPath = pathToRoot(other).reverse();

    // Find count in common
    let numCommon = 0;
    for (
      numCommon = 0;
      numCommon < Math.min(otherPath.length, nodePath.length);
      ++numCommon
    ) {
      if (otherPath[numCommon] !== nodePath[numCommon]) {
        break;
      }
    }
    --numCommon;

    if (numCommon < 0) {
      return false;
    }

    const lastCommonParent = nodePath[numCommon];
    if (lastCommonParent === node) {
      return true;
    }
    if (lastCommonParent === other) {
      return false;
    }

    const paintOrdering = lastCommonParent.siblings().layoutOrder();

    const findPaintIndex = (nodes: DirectionNode[]) => {
      return paintOrdering.indexOf(
        reverseDirection(nodes[numCommon + 1].parentDirection())
      );
    };
    const nodePaintIndex = findPaintIndex(nodePath);
    const otherPaintIndex = findPaintIndex(otherPath);

    return nodePaintIndex < otherPaintIndex;
  }