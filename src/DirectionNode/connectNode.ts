import { Direction, reverseDirection } from "../Direction";

import Alignment from "./Neighbors/Alignment";
import { findPaintGroup } from "./PaintGroups/findPaintGroup";

import { DirectionNode } from "./DirectionNode";

/**
 * Connects the given node to this node in the specified direction.
 *
 * If the node already has a parent, it will be disconnect. If this node already
 * has a child in the specified direction, that child will be disconected.
 *
 * This will invalidate the layout of the parent.
 *
 * @param {DirectionNode} parent - the node that will attach the child
 * @param {Direction} inDirection - the direction to attach the given node, relative to the parent
 * @param {DirectionNode} node - the node to attach
 * @return {DirectionNode} the given node
 * @throws if inDirection is NULL, OUTWARD
 * @throws if inDirection is the parent's direction
 */
export const connectNode = (
  parent: DirectionNode,
  inDirection: Direction,
  node: DirectionNode
): DirectionNode => {
  // Ensure the node can be connected in the given direction.
  if (inDirection == Direction.OUTWARD) {
    throw new Error(
      "By rule, nodes cannot be spawned in the outward direction."
    );
  }
  if (inDirection === undefined) {
    throw new Error("Direction must not be undefined");
  }
  if (inDirection === parent.neighbors().parentDirection()) {
    throw new Error("Cannot connect a node in the parent's direction");
  }
  if (parent.neighbors().hasNode(inDirection)) {
    parent.disconnect(inDirection);
  }
  if (!node.neighbors().isRoot()) {
    node.disconnect();
  }
  if (node.neighbors().hasNode(reverseDirection(inDirection))) {
    node.disconnect(reverseDirection(inDirection));
  }

  // Connect the node.
  const neighbor = parent.neighbors().ensure(inDirection);
  // Allow alignments to be set before children are spawned.
  if (neighbor.getAlignment() === Alignment.NULL) {
    neighbor.align(Alignment.NONE);
  }
  neighbor.meet(node);
  node.neighbors().assignParent(parent, inDirection);

  if (node.paintGroups().paintGroup().explicit()) {
    const pg = findPaintGroup(parent);
    pg.paintGroups().paintGroup().append(node);
  } else {
    parent.siblings().insertIntoLayout(inDirection);
    node.paintGroups().setPaintGroupNode(parent.paintGroups().paintGroupNode());
    node
      .siblings()
      .forEach((n) =>
        n.paintGroups().setPaintGroupNode(parent.paintGroups().paintGroupNode())
      );
    if (node.paintGroups().paintGroup().next() !== node) {
      const pg = findPaintGroup(parent);
      pg.paintGroups().paintGroup().merge(node);
    }
    node.paintGroups().clearPaintGroup();
  }

  parent.invalidate();

  return node;
};
