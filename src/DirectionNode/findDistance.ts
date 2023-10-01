import { pathToRoot } from "./pathToRoot";
import { DirectionNode } from "./DirectionNode";

export const findDistance = (node: DirectionNode, other: DirectionNode): number => {
  if (node === other) {
    return 0;
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

  if (numCommon === 0) {
    return Infinity;
  }

  const rv = nodePath.length - numCommon + (otherPath.length - numCommon);
  return rv;
};
