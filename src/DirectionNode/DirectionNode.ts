import createException, {
  BAD_NODE_DIRECTION,
  NODE_IS_ROOT,
  CANNOT_AFFECT_PARENT,
  NO_NODE_FOUND,
  NO_OUTWARD_CONNECT,
  NO_PARENT_CONNECT,
  NOT_PAINT_GROUP,
} from "../Exception";

import {
  Direction,
  isCardinalDirection,
  reverseDirection,
  forEachDirection,
} from "../Direction";

import { Layout } from "./Layout";

import { LayoutPhase } from "./Layout";
import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";
import { NeighborData } from "./NeighborData";
import { DirectionNodeSiblings } from "./DirectionNodeSiblings";
import {
  DirectionNodePaintGroup,
  PaintGroupNode,
} from "./DirectionNodePaintGroup";
import { DirectionNodeState } from "./DirectionNodeState";

import { Neighbors } from "./Neighbors";
import { findPaintGroup } from "./findPaintGroup";

export class DirectionNode<Value = any>
  implements PaintGroupNode<DirectionNode<Value>>
{
  private _layout?: Layout;

  private _state: DirectionNodeState<Value, DirectionNode<Value>>;

  private _neighbors: Neighbors<DirectionNode<Value>>;

  private _siblings: DirectionNodeSiblings<DirectionNode<Value>>;
  private _paintGroup:
    | DirectionNodePaintGroup<DirectionNode<Value>>
    | undefined;
  private _paintGroupRoot: DirectionNode;

  constructor(value?: Value) {
    // Neighbors
    this._neighbors = new Neighbors<DirectionNode<Value>>(this);

    // Layout
    this._siblings = new DirectionNodeSiblings<DirectionNode<Value>>(this);
    this._paintGroupRoot = this;
    this._paintGroup = new DirectionNodePaintGroup<DirectionNode<Value>>(
      this,
      false
    );

    if (value !== undefined) {
      this.setValue(value);
    }
  }

  layoutChanged(): void {
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

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Neighbors
  //
  // ///////////////////////////////////////////////////////////////////////////

  neighbors(): Neighbors<DirectionNode<Value>> {
    return this._neighbors;
  }

  neighborAt(dir: Direction): NeighborData<DirectionNode<Value>> {
    return this.neighbors().at(dir);
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Node parent
  //
  // ///////////////////////////////////////////////////////////////////////////

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
  // Node root
  //
  // ///////////////////////////////////////////////////////////////////////////

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Siblings
  //
  // ///////////////////////////////////////////////////////////////////////////

  siblings(): DirectionNodeSiblings<DirectionNode<Value>> {
    return this._siblings;
  }

  eachChild(
    visitor: (node: DirectionNode, dir: Direction) => void,
    visitorThisArg?: object
  ): void {
    const dirs = this.siblings().layoutOrder();
    for (let i = 0; i < dirs.length; ++i) {
      const dir = dirs[i];
      if (!this.neighbors().isRoot() && dir === this.parentDirection()) {
        continue;
      }
      const node = this.neighbors().nodeAt(dir);
      if (node) {
        visitor.call(visitorThisArg, node, dir);
      }
    }
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Paint groups
  //
  // ///////////////////////////////////////////////////////////////////////////

  /**
   * Gets this node's paint group, if it is a paint group.
   *
   * @return {DirectionNodePaintGroup | undefined} this node's paint group, or undefined if it is not a paint group.
   */
  localPaintGroup(): DirectionNodePaintGroup<DirectionNode<Value>> | undefined {
    return this._paintGroup;
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
  paintGroupRoot(): DirectionNode {
    return this._paintGroupRoot;
  }

  /**
   * Changes the paint group root.
   *
   * This does not trigger a layout change.
   *
   * @param {DirectionNode} pg - the new paint group root
   */
  setPaintGroupRoot(pg: DirectionNode) {
    if (!pg) {
      throw new Error("Refusing to set paint group root to null");
    }
    this._paintGroupRoot = pg;
  }

  /**
   * Gets the paint group used for this DirectionNode.
   *
   * @return {DirectionNodePaintGroup} the paint group used for this DirectionNode.
   */
  paintGroup(): DirectionNodePaintGroup<DirectionNode<Value>> {
    if (!this._paintGroup) {
      const node = this.paintGroupRoot();
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

  forEachPaintGroup(func: (node: DirectionNode<Value>) => void): void {
    let node: DirectionNode<Value> = this;
    let prev = node;
    do {
      if (!node.paintGroup()) {
        throw createException(NOT_PAINT_GROUP);
      }
      func(node);
      node = node.paintGroup().prev();
      if (prev === node && node !== this) {
        throw new Error("loop detected");
      }
      prev = node;
    } while (node !== this);
  }


  crease() {
    if (this.localPaintGroup()) {
      this.paintGroup().crease();
    } else {
      this._paintGroup = new DirectionNodePaintGroup<DirectionNode<Value>>(
        this,
        true
      );
    }
  }

  uncrease() {
    if (this.paintGroup()) {
      this.paintGroup().uncrease();
    }
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
      node.setPaintGroupRoot(this.paintGroupRoot());
      node
        .siblings()
        .forEachNode((n) => n.setPaintGroupRoot(this.paintGroupRoot()));
      if (node.paintGroup().next() !== node) {
        const pg = findPaintGroup(this);
        pg.paintGroup().merge(node);
      }
      node.clearPaintGroup();
    }

    this.layoutChanged();

    return node;
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
    const neighbor = this.neighborAt(inDirection);
    const disconnected = neighbor.neighbor() as this;

    const clearExplicit = !disconnected.localPaintGroup();
    if (!disconnected.localPaintGroup()) {
      disconnected.crease();
    }
    neighbor.leave();
    disconnected.neighbors().assignParent(undefined);
    disconnected.paintGroup().disconnect();

    if (clearExplicit) {
      disconnected.paintGroup().clearExplicit();
    }

    disconnected.siblings().convertLayoutPreference(inDirection);
    this.layoutChanged();

    return disconnected;
  }

  eraseNode(givenDirection: Direction): void {
    if (!this.neighbors().hasNode(givenDirection)) {
      return;
    }
    if (
      !this.neighbors().isRoot() &&
      givenDirection == this.parentDirection()
    ) {
      throw createException(CANNOT_AFFECT_PARENT);
    }
    this.disconnectNode(givenDirection);
  }

  destroy(): void {
    if (!this.neighbors().isRoot()) {
      this.disconnectNode();
    }
    this.neighbors().destroy();
    this.layout().setPhase(LayoutPhase.NULL);
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Node state
  //
  // ///////////////////////////////////////////////////////////////////////////

  hasState() {
    return !!this._state;
  }

  state() {
    if (!this._state) {
      this._state = new DirectionNodeState(this);
    }
    return this._state;
  }

  id() {
    return this.state().id();
  }

  setId(id: string | number) {
    this.state().setId(id);
    return this;
  }

  value(): Value | undefined {
    return this.hasState() ? this.state().value() : undefined;
  }

  setValue(value: Value | undefined) {
    return this.state().setValue(value);
  }

  nodeAlignmentMode(inDirection: Direction): Alignment {
    if (this.neighbors().hasNode(inDirection)) {
      return this.neighborAt(inDirection).alignmentMode;
    }
    return Alignment.NULL;
  }

  setNodeAlignmentMode(
    inDirection: Direction | Alignment,
    newAlignmentMode?: Alignment
  ): void {
    if (newAlignmentMode === undefined) {
      return this.parentNode().setNodeAlignmentMode(
        reverseDirection(this.parentDirection()),
        inDirection as Alignment
      );
    }
    this.neighbors().ensure(inDirection as Direction).alignmentMode =
      newAlignmentMode;
    this.layoutChanged();
  }

  axisOverlap(inDirection?: Direction): AxisOverlap {
    if (inDirection === undefined) {
      return this.parentNode().axisOverlap(
        reverseDirection(this.parentDirection())
      );
    }
    if (this.neighbors().hasNode(inDirection)) {
      return this.neighborAt(inDirection).allowAxisOverlap;
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
    this.layoutChanged();
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Position
  //
  // ///////////////////////////////////////////////////////////////////////////

  x(): number {
    if (this.neighbors().isRoot()) {
      return 0;
    }
    return this.neighbors().parent()?.xPos ?? NaN;
  }

  y(): number {
    if (this.neighbors().isRoot()) {
      return 0;
    }
    return this.neighbors().parent()?.yPos ?? NaN;
  }

  setPosAt(inDirection: Direction, x: number, y: number): void {
    this.neighborAt(inDirection).xPos = x;
    this.neighborAt(inDirection).yPos = y;
  }

  separationAt(inDirection: Direction): number {
    // Exclude some directions that cannot be calculated.
    if (!isCardinalDirection(inDirection)) {
      throw createException(BAD_NODE_DIRECTION);
    }

    // If the given direction is the parent's direction, use
    // their measurement instead.
    if (!this.neighbors().isRoot() && inDirection == this.parentDirection()) {
      return this.parentNode().separationAt(reverseDirection(inDirection));
    }

    if (!this.neighbors().hasNode(inDirection)) {
      throw createException(NO_NODE_FOUND);
    }

    return this.neighborAt(inDirection).separation;
  }

  lineLengthAt(direction: Direction): number {
    if (!this.neighbors().hasNode(direction)) {
      return 0;
    }
    return this.neighborAt(direction).lineLength;
  }
}
