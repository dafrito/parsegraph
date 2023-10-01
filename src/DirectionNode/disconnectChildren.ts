import { DirectionNode } from "./DirectionNode";
import { Direction, forEachDirection } from "../Direction";

export const disconnectChildren = (parent: DirectionNode): DirectionNode[] => {
  const nodes: DirectionNode[] = [];
  forEachDirection((dir: Direction) => {
    if (dir === Direction.OUTWARD) {
      return;
    }
    if (parent.neighbors().parentDirection() === dir) {
      return;
    }
    if (parent.neighbors().hasNode(dir)) {
      const removed = parent.disconnect(dir);
      if (!removed) {
        throw new Error("removed no node in a direction that has a node?");
      }
      nodes.push(removed);
    }
  });
  return nodes;
};
