import { Fit } from "./Fit";

import { Direction } from "../Direction";

import { Layout } from "./Layout";

import { LayoutPhase } from "./Layout";
import { Siblings } from "./Siblings";
import { PaintGroups, PaintGroup } from "./PaintGroups";

import { Neighbors } from "./Neighbors/Neighbors";
import { connectNode } from "./connectNode";
import { disconnectNode } from "./disconnectNode";

const nodeIdPrefix = Date.now() + Math.random() + "-";
let nodeCount = 0;
export class DirectionNode<Value = any> {
  private _layout?: Layout;

  private _neighbors: Neighbors;

  private _siblings: Siblings;
  private _paintGroups: PaintGroups;
  private _id: string | number | undefined;
  private _nodeFit: Fit;
  private _rightToLeft: boolean;
  private _scale: number;
  private _value?: Value;

  constructor(value?: Value) {
    this._id = nodeIdPrefix + nodeCount++;
    this._value = undefined;
    this._nodeFit = Fit.LOOSE;
    this._rightToLeft = false;
    this._scale = 1.0;

    this._paintGroups = new PaintGroups(this);
    this._paintGroups.setPaintGroup(new PaintGroup(this, false));

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
    if (!this._neighbors) {
      this._neighbors = new Neighbors(this);
    }
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
   * @return { Value | undefined } the new value
   */
  setValue(newValue: Value | undefined): Value | undefined {
    // console.log("Setting value to ", newValue);
    const orig = this.value();
    if (orig === newValue) {
      return orig;
    }
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
    if (!this._siblings) {
      this._siblings = new Siblings(this);
    }
    return this._siblings;
  }

  paintGroups(): PaintGroups {
    return this._paintGroups;
  }

  /**
   * @return {PaintGroup} this node's current paint group.
   */
  paintGroup(): PaintGroup {
    return this.paintGroups().paintGroup();
  }

  /**
   * Connects the given node to this node in the specified direction.
   *
   * If the node already has a parent, it will be disconnected. If this node already
   * has a child in the specified direction, that child will be disconected.
   *
   * This will invalidate the layout of this node.
   *
   * @param {Direction} inDirection - the direction to attach the given node
   * @param {DirectionNode<Value>} node - the node to attach
   * @return {DirectionNode} the given node
   */
  connect(
    inDirection: Direction,
    node: DirectionNode<Value>
  ): DirectionNode<Value> {
    return connectNode(this, inDirection, node);
  }

  /**
   * Removes the child in the specified direction.
   *
   * @param {Direction | undefined} inDirection - the direction of the child. If undefined, the node to remove
   * is this node from its parent.
   * @return {DirectionNode | undefined} the disconnected node, or undefined if no node was disconnected.
   * If this node was to be removed and this node is a root node, this node is returned.
   */
  disconnect(inDirection?: Direction): DirectionNode | undefined {
    return disconnectNode(this, inDirection);
  }
}
