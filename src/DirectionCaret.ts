import createException, { NO_NODE_FOUND } from "./Exception";
import { Direction, readDirection, reverseDirection } from "./Direction";
import { DirectionNode } from "./DirectionNode";

import {
  PreferredAxis,
  Fit,
  AxisOverlap,
  readAxisOverlap,
  Alignment,
  readAlignment,
} from "./DirectionNode";

// The scale at which shrunk nodes are shrunk.
export const SHRINK_SCALE = 0.85;

let nextID = 0;

/**
 * DirectionCaret lets you build graphs rapidly, without needing to manually
 * instantiate one node.
 */
export class DirectionCaret<Value> {
  private _nodeRoot: DirectionNode<Value>;
  private _nodes: DirectionNode<Value>[];
  private _savedNodes: { [key: string]: DirectionNode<Value> } | undefined;

  constructor(given: any = null) {
    // A mapping of nodes to their saved names.
    this._savedNodes = undefined;

    this._nodeRoot = this.doSpawn(given) as DirectionNode<Value>;

    // Stack of nodes.
    this._nodes = [this._nodeRoot];
  }

  protected doSpawn(given?: any): DirectionNode<Value> {
    if (given instanceof DirectionNode) {
      return given as DirectionNode<Value>;
    }
    const rv = new DirectionNode<Value>();
    rv.setValue(given);
    return rv;
  }

  protected doReplace(node: DirectionNode<Value>, given?: Value) {
    return node.setValue(
      given instanceof DirectionNode
        ? (given as DirectionNode<Value>).value()
        : given
    );
  }

  clone(): DirectionCaret<Value> {
    return new DirectionCaret<Value>(this.node());
  }

  node(): DirectionNode<Value> {
    if (this._nodes.length === 0) {
      throw createException(NO_NODE_FOUND);
    }
    return this._nodes[this._nodes.length - 1];
  }

  has(inDirection: Direction | string): boolean {
    inDirection = readDirection(inDirection);
    return this.node().hasNode(inDirection);
  }

  connect(
    inDirection: Direction | string,
    node: DirectionNode<Value>
  ): DirectionNode<Value> {
    // Interpret the given direction for ease-of-use.
    inDirection = readDirection(inDirection);

    this.node().connectNode(inDirection, node);

    return node;
  }

  connectMove(
    inDirection: Direction | string,
    node: DirectionNode<Value>
  ): DirectionNode<Value> {
    // Interpret the given direction for ease-of-use.
    inDirection = readDirection(inDirection);

    this.connect(inDirection, node);
    this.move(inDirection);
    return node;
  }

  disconnect(
    inDirection?: Direction | string
  ): DirectionNode<Value> | undefined {
    if (inDirection) {
      // Interpret the given direction for ease-of-use.
      inDirection = readDirection(inDirection);
      return this.node().disconnectNode(inDirection);
    }

    if (this.node().isRoot()) {
      return this.node();
    }

    return this.node()
      .parentNode()
      .disconnectNode(reverseDirection(this.node().parentDirection()));
  }

  crease(inDirection?: Direction | string): void {
    let node: DirectionNode<Value> = this.node();
    if (inDirection) {
      node = this.node().nodeAt(readDirection(inDirection));
    }

    // Create a new paint group for the connection.
    node.crease();
  }

  uncrease(inDirection?: Direction | string) {
    let node: DirectionNode<Value> = this.node();
    if (inDirection) {
      node = this.node().nodeAt(readDirection(inDirection));
    }

    // Remove the paint group.
    node.uncrease();
  }

  isCreased(inDirection?: Direction | string): boolean {
    let node: DirectionNode<Value> = this.node();
    if (inDirection) {
      node = this.node().nodeAt(readDirection(inDirection));
    }

    return !!node.localPaintGroup();
  }

  creased(inDirection?: Direction | string): boolean {
    return this.isCreased(inDirection);
  }

  erase(inDirection: Direction | string): void {
    inDirection = readDirection(inDirection);
    this.node().eraseNode(inDirection);
  }

  move(toDirection: Direction | string): void {
    toDirection = readDirection(toDirection);
    const dest: DirectionNode<Value> = this.node().nodeAt(toDirection);
    if (!dest) {
      throw createException(NO_NODE_FOUND);
    }
    this._nodes[this._nodes.length - 1] = dest;
  }

  push(): void {
    this._nodes.push(this.node());
  }

  save(id?: string): string {
    if (id === undefined) {
      id = ++nextID + "";
    }
    if (!this._savedNodes) {
      this._savedNodes = {};
    }
    this._savedNodes[id] = this.node();
    return id;
  }

  clearSave(id: string): void {
    if (!this._savedNodes) {
      return;
    }
    if (id === undefined) {
      id = "";
    }
    delete this._savedNodes[id];
  }

  restore(id: string): void {
    if (!this._savedNodes) {
      throw createException(NO_NODE_FOUND);
    }
    const loadedNode: DirectionNode<Value> = this._savedNodes[id];
    if (loadedNode == null) {
      throw createException(NO_NODE_FOUND);
    }
    this.setNode(loadedNode);
  }

  moveTo(id: string): void {
    this.restore(id);
  }

  moveToRoot(): void {
    this.setNode(this._nodeRoot);
  }

  protected setNode(node: DirectionNode): void {
    this._nodes[this._nodes.length - 1] = node;
  }

  moveToParent(): void {
    if (this.node().isRoot()) {
      throw new Error("cannot move to parent of root");
    }
    this.setNode(this.node().parentNode());
  }

  pop(): void {
    if (this._nodes.length <= 1) {
      throw createException(NO_NODE_FOUND);
    }
    this._nodes.pop();
  }

  pull(given: Direction | string): void {
    given = readDirection(given);
    this.node().siblings().pull(given);
  }

  /*
   * Returns the initially provided node.
   */
  root(): DirectionNode<Value> {
    return this._nodeRoot;
  }

  align(
    inDirection: Direction | string,
    newAlignmentMode: Alignment | string
  ): void {
    inDirection = readDirection(inDirection);
    newAlignmentMode = readAlignment(newAlignmentMode);

    this.node().setNodeAlignmentMode(inDirection, newAlignmentMode);
    if (newAlignmentMode != Alignment.NONE) {
      this.node().state().setNodeFit(Fit.EXACT);
    }
  }

  overlapAxis(...args: any[]): void {
    if (args.length === 0) {
      this.node().setAxisOverlap(AxisOverlap.ALLOWED);
      return;
    }
    if (args.length === 1) {
      this.node().setAxisOverlap(readAxisOverlap(args[0]));
      return;
    }
    const inDirection: Direction = readDirection(args[0]);
    const newAxisOverlap: AxisOverlap = readAxisOverlap(args[1]);
    this.node().setAxisOverlap(inDirection, newAxisOverlap);
  }

  axisOverlap(...args: any[]): void {
    return this.overlapAxis(...args);
  }

  shrink(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.nodeAt(readDirection(inDirection));
    }
    if (node) {
      node.state().setScale(SHRINK_SCALE);
    }
  }

  grow(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.nodeAt(readDirection(inDirection));
    }
    if (node) {
      node.state().setScale(1.0);
    }
  }

  fitExact(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.nodeAt(readDirection(inDirection));
    }
    node.state().setNodeFit(Fit.EXACT);
  }

  fitLoose(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.nodeAt(readDirection(inDirection));
    }
    node.state().setNodeFit(Fit.LOOSE);
  }

  fitNaive(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.nodeAt(readDirection(inDirection));
    }
    node.state().setNodeFit(Fit.NAIVE);
  }

  // ////////////////////////////////////////////////////////////////////////////
  //
  // Type-related methods
  //
  // ////////////////////////////////////////////////////////////////////////////

  spawn(
    inDirection: Direction | string,
    newType?: any,
    newAlignmentMode?: Alignment | string
  ): DirectionNode<Value> {
    // Interpret the given direction and type for ease-of-use.
    inDirection = readDirection(inDirection);

    // Spawn a node in the given direction.
    const created = this.doSpawn(newType);
    this.node().connectNode(inDirection, created);
    created.siblings().setLayoutPreference(PreferredAxis.PERPENDICULAR);
    created.state().setNodeFit(this.node().state().nodeFit());

    // Use the given alignment mode.
    if (newAlignmentMode !== undefined) {
      newAlignmentMode = readAlignment(newAlignmentMode);
      this.align(inDirection, newAlignmentMode);
      if (newAlignmentMode !== Alignment.NONE) {
        this.node().state().setNodeFit(Fit.EXACT);
      }
    }

    return created;
  }

  replace(...args: any[]): void {
    // Retrieve the arguments.
    let node = this.node();
    let withType: DirectionNode<Value> | string;
    if (args.length > 1) {
      node = node.nodeAt(readDirection(args[0]));
      withType = args[1];
    } else {
      withType = args[0];
    }
    this.doReplace(node, withType);
  }

  spawnMove(
    inDirection: Direction | string,
    newType?: DirectionNode<Value> | Value,
    newAlignmentMode?: Alignment | string
  ): DirectionNode<Value> {
    const created = this.spawn(inDirection, newType, newAlignmentMode);
    this.move(inDirection);
    return created;
  }

  at(inDirection: Direction | string): DirectionNode<Value> {
    inDirection = readDirection(inDirection);
    if (this.node().hasNode(inDirection)) {
      return this.node().nodeAt(inDirection);
    }
    throw new Error("No node at direction");
  }

  id(val?: string | number) {
    if (arguments.length === 0) {
      return this.node().state().id();
    }
    this.node().state().setId(val);
  }
}
