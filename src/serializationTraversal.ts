import { DirectionNode } from "./DirectionNode/DirectionNode";

/**
 * Shared serialization walk; preserves the legacy paint-group/sibling order.
 * @param {DirectionNode} root - Graph traversal starting point.
 * @param {function} visit - Callback for each visited node.
 */
export function forEachSerializedNode(
  root: DirectionNode,
  visit: (node: DirectionNode) => void
): void {
  root.paintGroup().forEach((group) => group.siblings().forEach(visit));
}
