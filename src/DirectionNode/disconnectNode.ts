import { Direction, reverseDirection } from "../Direction";
import { DirectionNode } from "..";

/**
 * Removes the child in the specified direction.
 *
 * This will invalidate the parent.
 *
 * @param {DirectionNode} parent - the parent that will remove the child
 * @param {Direction | undefined} inDirection - the direction of the child. If undefined, the node to remove
 * is this node from its parent.
 * @return {DirectionNode | undefined} the disconnected node, or undefined if no node was disconnected.
 * If this node was to be removed and this node is a root node, this node is returned.
 */
export const disconnectNode = (
  parent: DirectionNode,
  inDirection?: Direction
): DirectionNode | undefined => {
  if (inDirection === undefined) {
    if (parent.neighbors().isRoot()) {
      return parent;
    }
    return parent
      .neighbors()
      .parentNode()
      .disconnect(reverseDirection(parent.neighbors().parentDirection()));
  }
  if (!parent.neighbors().hasNode(inDirection)) {
    return undefined;
  }

  if (
    !parent.neighbors().isRoot() &&
    parent.neighbors().parentDirection() === inDirection
  ) {
    return parent
      .neighbors()
      .parentNode()
      .disconnect(reverseDirection(parent.neighbors().parentDirection()));
  }
  // Disconnect the node.
  const neighbor = parent.neighbors().at(inDirection);
  const disconnected = neighbor.neighbor() as DirectionNode;

  const clearExplicit = !disconnected.isPaintGroup();
  if (!disconnected.isPaintGroup()) {
    disconnected.crease();
  }
  neighbor.leave();
  disconnected.neighbors().assignParent(undefined);
  disconnected.paintGroup().disconnect();

  if (clearExplicit) {
    disconnected.paintGroup().clearExplicit();
  }

  disconnected.siblings().convertLayoutPreference(inDirection);
  parent.invalidate();

  return disconnected;
};
