import { DirectionNode } from "./DirectionNode";
import { findClosestPaintGroup } from "./findClosestPaintGroup";
import makeLimit from "./makeLimit";
import { comesBefore } from ".";
import { getLastPaintGroup } from "./getLastPaintGroup";

export const findPaintGroupInsert = (
    node: DirectionNode,
    inserted: DirectionNode
  ): [DirectionNode, DirectionNode] => {
  if (!node.localPaintGroup()) {
    return findPaintGroupInsert(node.paintGroup().node(), inserted);
  }

  // Gather possible insertion points; exclude this node.
  const paintGroupCandidates: DirectionNode[] = [];
  const lim = makeLimit();
  let n = node.paintGroup().next();
  while (n !== node) {
    paintGroupCandidates.push(n);
    lim();
    n = n.paintGroup().next();
  }
  paintGroupCandidates.push(getLastPaintGroup(node));

  const closestPaintGroup = findClosestPaintGroup(
    inserted,
    paintGroupCandidates
  );

  if (comesBefore(closestPaintGroup, inserted)) {
    const endOfPaintGroup = getLastPaintGroup(closestPaintGroup);
    return [endOfPaintGroup, endOfPaintGroup.paintGroup().next()];
  }
  return [closestPaintGroup.paintGroup().prev(), closestPaintGroup];
};
