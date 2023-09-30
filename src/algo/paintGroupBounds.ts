import Size from "./size";
import Direction, { DirectionNode, nameDirection } from "./direction";

export default function paintGroupBounds(nodeRoot: DirectionNode) {
  if (!nodeRoot.isRoot() && !nodeRoot.localPaintGroup()) {
    throw new Error("Node must be a paint group");
  }
  let node = nodeRoot;
  const parentSize = new Size();
  const groupBounds: { [id: number]: any } = {};
  // let numNodes = 0;
  do {
    // ++numNodes;
    node = node.siblings().next() as DirectionNode;
    node.value().size(parentSize);
    const parentBounds = {
      left: parentSize.width() / 2,
      top: parentSize.height() / 2,
      right: parentSize.width() / 2,
      bottom: parentSize.height() / 2,
    };
    groupBounds[node.state().id() as number] = parentBounds;
    const order = node.layoutOrder();
    for (let i = 0; i < order.length; ++i) {
      const dir = order[i];
      if (dir === Direction.OUTWARD || dir === Direction.INWARD) {
        continue;
      }
      if (!node.hasChildAt(dir)) {
        continue;
      }
      const child = node.nodeAt(dir);
      if (child.findPaintGroup() === nodeRoot) {
        // Node is part of the same paint group.
        const childBounds = groupBounds[child.state().id() as number];
        if (!childBounds) {
          throw new Error(
            "Child paint group bounds must have" +
              " been calculated before its parent"
          );
        }
        if (Number.isNaN(childBounds.left)) {
          throw new Error("Bounds must not be NaN");
        }
        const neighbor = node.neighborAt(dir);
        switch (dir) {
          case Direction.UPWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top + neighbor.separation
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left - neighbor.alignmentOffset
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right + neighbor.alignmentOffset
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom - neighbor.separation
            );
            break;
          case Direction.DOWNWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top - neighbor.separation
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left - neighbor.alignmentOffset
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right + neighbor.alignmentOffset
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom + neighbor.separation
            );
            break;
          case Direction.FORWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top - neighbor.alignmentOffset
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left - neighbor.separation
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right + neighbor.separation
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom + neighbor.alignmentOffset
            );
            break;
          case Direction.BACKWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              childBounds.top - neighbor.alignmentOffset
            );
            parentBounds.left = Math.max(
              parentBounds.left,
              childBounds.left + neighbor.separation
            );
            parentBounds.right = Math.max(
              parentBounds.right,
              childBounds.right - neighbor.separation
            );
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              childBounds.bottom + neighbor.alignmentOffset
            );
            break;
          default:
            throw new Error("Unexpected node direction: " + nameDirection(dir));
        }
      } else {
        // Node is part of a different paint group.
        const neighbor = node.neighborAt(dir);
        switch (dir) {
          case Direction.UPWARD:
            parentBounds.top = Math.max(
              parentBounds.top,
              parentSize.height() / 2 + neighbor.lineLength
            );
            break;
          case Direction.DOWNWARD:
            parentBounds.bottom = Math.max(
              parentBounds.bottom,
              parentSize.height() / 2 + neighbor.lineLength
            );
            break;
          case Direction.FORWARD:
            parentBounds.right = Math.max(
              parentBounds.right,
              parentSize.width() / 2 + neighbor.lineLength
            );
            break;
          case Direction.BACKWARD:
            parentBounds.left = Math.max(
              parentBounds.left,
              parentSize.width() / 2 + neighbor.lineLength
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
  return groupBounds[node.state().id() as number];
}
