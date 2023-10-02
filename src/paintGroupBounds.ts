import { Direction, nameDirection } from "./Direction";
import { DirectionNode } from "./DirectionNode";
import { findPaintGroup } from "./DirectionNode/findPaintGroup";

export function paintGroupBounds(nodeRoot: DirectionNode) {
  if (
    !nodeRoot.neighbors().isRoot() &&
    !nodeRoot.paintGroups().isPaintGroup()
  ) {
    throw new Error("Node must be a paint group");
  }
  let node = nodeRoot;
  const parentSize = [NaN, NaN];
  const groupBounds: { [id: number]: any } = {};
  // let numNodes = 0;
  do {
    // ++numNodes;
    node = node.siblings().next() as DirectionNode;
    node.value().size(parentSize);
    const parentBounds = {
      left: parentSize[0] / 2,
      top: parentSize[1] / 2,
      right: parentSize[0] / 2,
      bottom: parentSize[1] / 2,
    };
    groupBounds[node.id() as number] = parentBounds;
    const order = node.siblings().layoutOrder();
    for (let i = 0; i < order.length; ++i) {
      const dir = order[i];
      if (dir === Direction.OUTWARD || dir === Direction.INWARD) {
        continue;
      }
      if (!node.neighbors().hasChildAt(dir)) {
        continue;
      }
      const child = node.neighbors().nodeAt(dir);
      if (findPaintGroup(child) === nodeRoot) {
        // Node is part of the same paint group.
        const childBounds = groupBounds[child.id() as number];
        if (!childBounds) {
          throw new Error(
            "Child paint group bounds must have" +
              " been calculated before its parent"
          );
        }
        if (Number.isNaN(childBounds.left)) {
          throw new Error("Bounds must not be NaN");
        }
        const neighbor = node.neighbors().at(dir);
        switch (dir) {
          case Direction.UPWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top + neighbor.separation()
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left - neighbor.alignmentOffset()
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right + neighbor.alignmentOffset()
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom - neighbor.separation()
            );
            break;
          case Direction.DOWNWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top - neighbor.separation()
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left - neighbor.alignmentOffset()
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right + neighbor.alignmentOffset()
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom + neighbor.separation()
            );
            break;
          case Direction.FORWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top - neighbor.alignmentOffset()
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left - neighbor.separation()
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right + neighbor.separation()
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom + neighbor.alignmentOffset()
            );
            break;
          case Direction.BACKWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top - neighbor.alignmentOffset()
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left + neighbor.separation()
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right - neighbor.separation()
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom + neighbor.alignmentOffset()
            );
            break;
          default:
            throw new Error("Unexpected node direction: " + nameDirection(dir));
        }
      } else {
        // Node is part of a different paint group.
        const neighbor = node.neighbors().at(dir);
        switch (dir) {
          case Direction.UPWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              parentSize[1] / 2 + neighbor.lineLength()
            );
            break;
          case Direction.DOWNWARD:
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              parentSize[1] / 2 + neighbor.lineLength()
            );
            break;
          case Direction.FORWARD:
            parentBounds.right = Math.max(
              parentBounds.right,
              parentSize[0] / 2 + neighbor.lineLength()
            );
            break;
          case Direction.BACKWARD:
            parentBounds.left = Math.max(
              parentBounds.left,
              parentSize[0] / 2 + neighbor.lineLength()
            );
            break;
          default:
            throw new Error("Unexpected node direction: " + nameDirection(dir));
        }
      }
    }
  } while (node !== nodeRoot);
  // console.log(
  //   nodeRoot,
  //   "Bounds in " + numNodes + " nodes", groupBounds[node._id]);
  return groupBounds[node.id() as number];
}
