import { DirectionNode } from "../DirectionNode";
import makeLimit from "./makeLimit";
import { comesBefore } from "./comesBefore";
import { getLastPaintGroup } from "./getLastPaintGroup";

export const findPaintGroupInsert = (
  node: DirectionNode,
  inserted: DirectionNode
): [DirectionNode, DirectionNode] => {
  if (!node.paintGroups().isPaintGroup()) {
    return findPaintGroupInsert(node.paintGroup().node(), inserted);
  }

  // Walk complete sibling group subtrees. A distance-based insertion can put
  // an ancestor after one of its deeper descendants, making layout wait forever
  // for a group it has not yet visited. Existing subtree blocks must also stay
  // intact if a preferred-axis change has altered sibling ordering since they
  // were inserted.
  const lim = makeLimit();
  const descendantLimit = makeLimit();
  // Existing descendants take priority over sibling ordering. Their containing
  // node may have changed preferred axes without rearranging the group ring;
  // placing a new ancestor before an unrelated sibling would split its block.
  let descendant = node.paintGroup().next();
  while (descendant !== node && descendant.neighbors().hasAncestor(node)) {
    descendantLimit();
    if (descendant.neighbors().hasAncestor(inserted)) {
      return [descendant.paintGroup().prev(), descendant];
    }
    descendant = descendant.paintGroup().next();
  }
  for (;;) {
    let previous = node;
    let candidate = node.paintGroup().next();
    let descend = false;
    while (candidate !== node && candidate.neighbors().hasAncestor(node)) {
      lim();
      if (inserted.neighbors().hasAncestor(candidate)) {
        // A caller can supply a more distant containing group.
        node = candidate;
        descend = true;
        break;
      }
      if (!comesBefore(candidate, inserted)) {
        return [previous, candidate];
      }
      previous = getLastPaintGroup(candidate);
      candidate = previous.paintGroup().next();
    }
    if (!descend) {
      return [previous, candidate];
    }
  }
};
