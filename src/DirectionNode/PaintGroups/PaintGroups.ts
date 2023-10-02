import { PaintGroup } from "./PaintGroup";
import { DirectionNode } from "../DirectionNode";

export class PaintGroups {
  private _paintGroup: PaintGroup | undefined;
  private _paintGroupNode: DirectionNode;
  private _node: DirectionNode;

  constructor(node: DirectionNode) {
    this._node = node;
    this._paintGroupNode = node;
    this._paintGroup = undefined;
  }

  node() {
    return this._node;
  }

  /**
   * Returns whether this node is a paint group root.
   *
   * @return {boolean} true if this node is a paint group root.
   */
  isPaintGroup(): boolean {
    return !!this._paintGroup;
  }

  /**
   * Clears this node's local paint group, if any.
   *
   * Called by the paint group when it is being removed.
   *
   * This is an internal method and does not trigger invalidation.
   */
  clearPaintGroup(): void {
    this._paintGroup = undefined;
  }

  /**
   * Gets the DirectionNode that is the paint group root for this DirectionNode.
   *
   * @return {DirectionNode} the paint group root for this DirectionNode.
   */
  paintGroupNode(): DirectionNode {
    return this._paintGroupNode;
  }

  /**
   * Changes the paint group root.
   *
   * This is an internal method and does not trigger invalidation.
   *
   * @param {DirectionNode} pg - the new paint group root
   */
  setPaintGroupNode(pg: DirectionNode) {
    if (!pg) {
      throw new Error("Refusing to set paint group root to null");
    }
    this._paintGroupNode = pg;
  }

  /**
   * Gets the paint group used for this DirectionNode.
   *
   * @return {PaintGroup} the paint group used for this DirectionNode.
   */
  paintGroup(): PaintGroup {
    if (!this._paintGroup) {
      const node = this.paintGroupNode();
      if (!node) {
        throw new Error("Paint group root is null");
      }
      if (node === this.node()) {
        throw new Error(
          "This root paint group doesn't have a paint group object"
        );
      }
      return node.paintGroups().paintGroup();
    }
    return this._paintGroup;
  }

  setPaintGroup(paintGroup: PaintGroup) {
    this._paintGroup = paintGroup;
  }

  /**
   * Creates a paint group for this node, and makes it explicit
   * so it will persist once connecting to a parent node.
   */
  crease() {
    if (this.isPaintGroup()) {
      this.paintGroup().crease();
    } else {
      this._paintGroup = new PaintGroup(this.node(), true);
    }
  }

  /**
   * Removes the paint group from this node, unless it is a root
   * node.
   */
  uncrease() {
    if (this.paintGroup()) {
      this.paintGroup().uncrease();
    }
  }
}
