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
import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";
import { Siblings } from "./Siblings";
import { PaintGroup } from "./PaintGroup";

import { Neighbors } from "./Neighbors";
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
  // Node state
  //
  // ///////////////////////////////////////////////////////////////////////////

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
        node = node.parentNode();
      } else {
        break;
      }
    }
  }

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

  getAlignment(inDirection: Direction): Alignment {
    if (this.neighbors().hasNode(inDirection)) {
      return this.neighbors().at(inDirection).alignmentMode;
    }
    return Alignment.NULL;
  }

  align(
    inDirection: Direction | Alignment,
    newAlignmentMode?: Alignment
  ): void {
    if (newAlignmentMode === undefined) {
      return this.parentNode().align(
        reverseDirection(this.parentDirection()),
        inDirection as Alignment
      );
    }
    this.neighbors().ensure(inDirection as Direction).alignmentMode =
      newAlignmentMode;
    this.invalidate();
  }

  axisOverlap(inDirection?: Direction): AxisOverlap {
    if (inDirection === undefined) {
      return this.parentNode().axisOverlap(
        reverseDirection(this.parentDirection())
      );
    }
    if (this.neighbors().hasNode(inDirection)) {
      return this.neighbors().at(inDirection).allowAxisOverlap;
    }
    return AxisOverlap.NULL;
  }

  setAxisOverlap(
    inDirection: Direction | AxisOverlap,
    newAxisOverlap?: AxisOverlap
  ): void {
    if (newAxisOverlap === undefined) {
      return this.parentNode().setAxisOverlap(
        reverseDirection(this.parentDirection()),
        inDirection as AxisOverlap
      );
    }
    this.neighbors().ensure(inDirection as Direction).allowAxisOverlap =
      newAxisOverlap;
    this.invalidate();
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Layout state
  //
  // ///////////////////////////////////////////////////////////////////////////

  layout(): Layout {
    if (!this._layout) {
      this._layout = new Layout(this);
    }
    return this._layout;
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Neighbors
  //
  // ///////////////////////////////////////////////////////////////////////////

  neighbors(): Neighbors {
    return this._neighbors;
  }

  parentDirection(): Direction {
    if (this.neighbors().isRoot()) {
      return Direction.NULL;
    }
    const n = this.neighbors().parent();
    if (n === undefined) {
      return Direction.NULL;
    }
    return reverseDirection(n.direction());
  }

  parentNode(): DirectionNode {
    if (this.neighbors().isRoot()) {
      throw createException(NODE_IS_ROOT);
    }
    return this.neighbors().parent()?.node() as this;
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Position
  //
  // ///////////////////////////////////////////////////////////////////////////

  parentX(): number {
    if (this.neighbors().isRoot()) {
      return 0;
    }
    return this.neighbors().parent()?.xPos ?? NaN;
  }

  parentY(): number {
    if (this.neighbors().isRoot()) {
      return 0;
    }
    return this.neighbors().parent()?.yPos ?? NaN;
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Siblings
  //
  // ///////////////////////////////////////////////////////////////////////////

  siblings(): Siblings {
    return this._siblings;
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Paint groups
  //
  // ///////////////////////////////////////////////////////////////////////////

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
   * This does not trigger a layout change.
   *
   * @param {DirectionNode} pg - the new paint group root
   */
  setpaintGroupNode(pg: DirectionNode) {
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

  crease() {
    if (this.isPaintGroup()) {
      this.paintGroup().crease();
    } else {
      this._paintGroup = new PaintGroup(this, true);
    }
  }

  uncrease() {
    if (this.paintGroup()) {
      this.paintGroup().uncrease();
    }
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Graph manipulators
  //
  // ///////////////////////////////////////////////////////////////////////////

  connectNode(
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
    if (inDirection == this.parentDirection()) {
      throw createException(NO_PARENT_CONNECT);
    }
    if (this.neighbors().hasNode(inDirection)) {
      this.disconnectNode(inDirection);
    }
    if (!node.neighbors().isRoot()) {
      node.disconnectNode();
    }
    if (node.neighbors().hasNode(reverseDirection(inDirection))) {
      node.disconnectNode(reverseDirection(inDirection));
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
      node.setpaintGroupNode(this.paintGroupNode());
      node
        .siblings()
        .forEachNode((n) => n.setpaintGroupNode(this.paintGroupNode()));
      if (node.paintGroup().next() !== node) {
        const pg = findPaintGroup(this);
        pg.paintGroup().merge(node);
      }
      node.clearPaintGroup();
    }

    this.invalidate();

    return node;
  }

  disconnectNode(inDirection?: Direction): DirectionNode | undefined {
    if (arguments.length === 0 || inDirection === undefined) {
      if (this.neighbors().isRoot()) {
        return this;
      }
      return this.parentNode().disconnectNode(
        reverseDirection(this.parentDirection())
      );
    }

    if (!this.neighbors().hasNode(inDirection)) {
      return undefined;
    }

    if (!this.neighbors().isRoot() && this.parentDirection() === inDirection) {
      return this.parentNode().disconnectNode(
        reverseDirection(this.parentDirection())
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
      if (this.parentDirection() === dir) {
        return;
      }
      if (this.neighbors().hasNode(dir)) {
        const removed = this.disconnectNode(dir);
        if (!removed) {
          throw new Error("removed no node in a direction that has a node?");
        }
        nodes.push(removed);
      }
    });
    return nodes;
  }
}
