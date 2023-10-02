import makeLimit from "./makeLimit";
import { DirectionNode } from "../DirectionNode";

export const pathToRoot = (n: DirectionNode) => {
  const nodes: DirectionNode[] = [];

  const lim = makeLimit();
  while (!n.neighbors().isRoot()) {
    nodes.push(n);
    n = n.neighbors().parentNode();
    lim();
  }

  // Push root, too.
  nodes.push(n);

  return nodes;
};
