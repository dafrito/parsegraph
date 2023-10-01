import createException, {
  BAD_NODE_DIRECTION,
  NODE_IS_ROOT,
  NO_OUTWARD_CONNECT,
  NO_PARENT_CONNECT,
} from "../Exception";
import { Fit } from "./Fit";

import { Direction, reverseDirection, forEachDirection } from "../Direction";

import { Layout } from "./Layout";

import { LayoutPhase } from "./Layout";
import Alignment from "./Neighbors/Alignment";
import { Siblings } from "./Siblings";
import { PaintGroup } from "./PaintGroup";

import { Neighbors } from "./Neighbors/Neighbors";
import { findPaintGroup } from "./findPaintGroup";

let nodeCount = 0;
export class DirectionNode<Value = any> {
  private _layout?: Layout;

  private _neighbors: Neighbors;

  private _siblings: Siblings;
  private _paintGroup: PaintGroup | undefined;
  private _paintGroupNode: DirectionNode;
  private _id: string | number | undefined;
  private _nodeFit: Fit;
  private _rightToLeft: boolean;
  private _scale: number;
  private _value?: Value;

  constructor(value?: Value) {
    this._id = nodeCount++;
    this._value = undefined;
    this._nodeFit = Fit.LOOSE;
    this._rightToLeft = false;
    this._scale = 1.0;

    // Neighbors
    this._neighbors = new Neighbors(this);

    // Layout
    this._siblings = new Siblings(this);
    this._paintGroupNode = this;
    this._paintGroup = new PaintGroup(this, false);

    if (value !== undefined) {
      this.setValue(value);
    }
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Invalidation
  //
  // ///////////////////////////////////////////////////////////////////////////

  layout(): Layout {
    if (!this._layout) {
      this._layout = new Layout(this);
    }
    return this._layout;
  }

  neighbors(): Neighbors {
    return this._neighbors;
  }

  invalidate(): void {
    let node: DirectionNode = this;
    while (node !== null) {
      const oldLayoutPhase = node.layout().phase();

      // Set the needs layout flag.
      node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);

      if (node.neighbors().isRoot()) {
        break;
      } else if (oldLayoutPhase === LayoutPhase.COMMITTED) {
        // Notify our parent, if we were previously committed.
        node = node.neighbors().parentNode();
      } else {
        break;
      }
    }
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Node state
  //
  // ///////////////////////////////////////////////////////////////////////////

  id(): string | number | undefined {
    return this._id;
  }

  setId(id: string | number | undefined) {
    this._id = id;
    return this;
  }

  value(): Value | undefined {
    return this._value;
  }

  /**
   * Sets a new value for this DirectionNode.
   *
   * The layout is invaidated if the value is changed.
   *
   * @param { Value | undefined } newValue - the new value to use
   * @return the new value
   */
  setValue(newValue: Value | undefined): Value | undefined {
    // console.log("Setting value to ", newValue);
    const orig = this.value();
    if (orig === newValue) {
      return orig;
    }
    const oldVal = this._value;
    this._value = newValue;
    this.invalidate();
    return this._value;
  }

  rightToLeft(): boolean {
    return this._rightToLeft;
  }

  setRightToLeft(val: boolean): void {
    this._rightToLeft = !!val;
    this.invalidate();
  }

  nodeFit(): Fit {
    return this._nodeFit;
  }

  setNodeFit(nodeFit: Fit): void {
    this._nodeFit = nodeFit;
    this.invalidate();
  }

  scale(): number {
    return this._scale;
  }

  setScale(scale: number): void {
    this._scale = scale;
    this.invalidate();
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Adjacency
  //
  // ///////////////////////////////////////////////////////////////////////////

  siblings(): Siblings {
    return this._siblings;
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
   * This does not trigger invalidation.
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
   * This does not trigger invalidation.
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
      if (node === this) {
        throw new Error(
          "This root paint group doesn't have a paint group object"
        );
      }
      return node.paintGroup();
    }
    return this._paintGroup;
  }

  /**
   * Creates a paint group for this node, and makes it explicit
   * so it will persist once connecting to a parent node.
   */
  crease() {
    if (this.isPaintGroup()) {
      this.paintGroup().crease();
    } else {
      this._paintGroup = new PaintGroup(this, true);
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

  connect(
    inDirection: Direction,
    node: DirectionNode<Value>
  ): DirectionNode<Value> {
    // Ensure the node can be connected in the given direction.
    if (inDirection == Direction.OUTWARD) {
      throw createException(NO_OUTWARD_CONNECT);
    }
    if (inDirection == Direction.NULL) {
      throw createException(BAD_NODE_DIRECTION);
    }
    if (inDirection == this.neighbors().parentDirection()) {
      throw createException(NO_PARENT_CONNECT);
    }
    if (this.neighbors().hasNode(inDirection)) {
      this.disconnect(inDirection);
    }
    if (!node.neighbors().isRoot()) {
      node.disconnect();
    }
    if (node.neighbors().hasNode(reverseDirection(inDirection))) {
      node.disconnect(reverseDirection(inDirection));
    }

    // Connect the node.
    const neighbor = this.neighbors().ensure(inDirection);
    // Allow alignments to be set before children are spawned.
    if (neighbor.alignmentMode == Alignment.NULL) {
      neighbor.alignmentMode = Alignment.NONE;
    }
    neighbor.meet(node);
    node.neighbors().assignParent(this, inDirection);

    if (node.paintGroup().explicit()) {
      const pg = findPaintGroup(this);
      pg.paintGroup().append(node);
    } else {
      this.siblings().insertIntoLayout(inDirection);
      node.setPaintGroupNode(this.paintGroupNode());
      node
        .siblings()
        .forEachNode((n) => n.setPaintGroupNode(this.paintGroupNode()));
      if (node.paintGroup().next() !== node) {
        const pg = findPaintGroup(this);
        pg.paintGroup().merge(node);
      }
      node.clearPaintGroup();
    }

    this.invalidate();

    return node;
  }

  disconnect(inDirection?: Direction): DirectionNode | undefined {
    if (arguments.length === 0 || inDirection === undefined) {
      if (this.neighbors().isRoot()) {
        return this;
      }
      return this.neighbors().parentNode().disconnect(
        reverseDirection(this.neighbors().parentDirection())
      );
    }

    if (!this.neighbors().hasNode(inDirection)) {
      return undefined;
    }

    if (!this.neighbors().isRoot() && this.neighbors().parentDirection() === inDirection) {
      return this.neighbors().parentNode().disconnect(
        reverseDirection(this.neighbors().parentDirection())
      );
    }
    // Disconnect the node.
    const neighbor = this.neighbors().at(inDirection);
    const disconnected = neighbor.neighbor() as this;

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
    this.invalidate();

    return disconnected;
  }

  disconnectChildren(): DirectionNode[] {
    const nodes: DirectionNode[] = [];
    forEachDirection((dir: Direction) => {
      if (dir === Direction.OUTWARD) {
        return;
      }
      if (this.neighbors().parentDirection() === dir) {
        return;
      }
      if (this.neighbors().hasNode(dir)) {
        const removed = this.disconnect(dir);
        if (!removed) {
          throw new Error("removed no node in a direction that has a node?");
        }
        nodes.push(removed);
      }
    });
    return nodes;
  }
}
