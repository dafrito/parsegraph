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
 * A builder of {@link DirectionNode} graphs.
 *
 * <ul>
 * <li>connect/disconnect</li>
 * <li>spawn/erase</li>
 * <li>move, moveToParent, moveToRoot</li>
 * <li>save/restore</li>
 * <li>push/pop</li>
 * </ul>
 */
export class DirectionCaret<Value> {
  private _nodeRoot: DirectionNode<Value>;
  private _nodes: DirectionNode<Value>[];
  private _savedNodes: { [key: string]: DirectionNode<Value> } | undefined;

  constructor(given?: Value | DirectionNode<Value>) {
    // A mapping of nodes to their saved names.
    this._savedNodes = undefined;

    this._nodeRoot = this.doSpawn(given) as DirectionNode<Value>;

    // Stack of nodes.
    this._nodes = [this._nodeRoot];
  }

  protected doSpawn(
    given?: Value | DirectionNode<Value>
  ): DirectionNode<Value> {
    if (given instanceof DirectionNode) {
      return given as DirectionNode<Value>;
    }
    const rv = new DirectionNode<Value>();
    rv.setValue(given);
    return rv;
  }

  protected doReplace(node: DirectionNode<Value>, given?: Value): void {
    node.setValue(
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
    return this.node().neighbors().hasNode(readDirection(inDirection));
  }

  connect(
    inDirection: Direction | string,
    node: DirectionNode<Value>
  ): DirectionNode<Value> {
    this.node().connectNode(readDirection(inDirection), node);

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
      return this.node().disconnectNode(readDirection(inDirection));
    }

    if (this.node().neighbors().isRoot()) {
      return this.node();
    }

    return this.node()
      .parentNode()
      .disconnectNode(reverseDirection(this.node().parentDirection()));
  }

  crease(inDirection?: Direction | string): void {
    let node: DirectionNode<Value> = this.node();
    if (inDirection) {
      node = this.node().neighbors().nodeAt(readDirection(inDirection));
    }

    // Create a new paint group for the connection.
    node.crease();
  }

  uncrease(inDirection?: Direction | string) {
    let node: DirectionNode<Value> = this.node();
    if (inDirection) {
      node = this.node().neighbors().nodeAt(readDirection(inDirection));
    }

    // Remove the paint group.
    node.uncrease();
  }

  isCreased(inDirection?: Direction | string): boolean {
    let node: DirectionNode<Value> = this.node();
    if (inDirection) {
      node = this.node().neighbors().nodeAt(readDirection(inDirection));
    }

    return !!node.isPaintGroup();
  }

  creased(inDirection?: Direction | string): boolean {
    return this.isCreased(inDirection);
  }

  move(toDirection: Direction | string): void {
    const dest: DirectionNode<Value> = this.node()
      .neighbors()
      .nodeAt(readDirection(toDirection));
    if (!dest) {
      throw createException(NO_NODE_FOUND);
    }
    this.setNode(dest);
  }

  /**
   * Saves the current node in the caret's stack of DirectionNodes.
   *
   * @see {@link pop} to return to this node.
   */
  push(): void {
    this._nodes.push(this.node());
  }

  /**
   * Saves the current node in the caret's map of DirectionNodes using the given key.
   *
   * @param {string | undefined } id - the key for the current node. If undefined, a new key will be created.
   * @return {string} the key used to save the current node
   *
   * @see {@link restore}
   */
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

  /**
   * Moves the caret to the saved node named by the given id.
   *
   * @param { string } id - the name of the saved node.
   *
   * @see {@link save}
   */
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

  /**
   * Alias for {@link restore}.
   *
   * @param {string} id - the name of the saved node to which to move the caret.
   */
  moveTo(id: string): void {
    this.restore(id);
  }

  /**
   * Returns to this caret's original node.
   */
  moveToRoot(): void {
    this.setNode(this._nodeRoot);
  }

  protected setNode(node: DirectionNode): void {
    this._nodes[this._nodes.length - 1] = node;
  }

  moveToParent(): void {
    if (this.node().neighbors().isRoot()) {
      throw new Error(
        "cannot move to parent of root (node is " + this.node().id() + ")"
      );
    }
    this.setNode(this.node().parentNode());
  }

  /**
   * Moves the caret to the most recently pushed node and removes it
   * from the caret's stack.
   *
   * @see {@link push}
   */
  pop(): void {
    if (this._nodes.length <= 1) {
      throw createException(NO_NODE_FOUND);
    }
    this._nodes.pop();
  }

  /**
   * Sets the current node's {@link PreferredAxis} to the given direction.
   *
   * @param {Direction | string} given - the direction of the neighbor to pull closer to this node
   *
   * @see {@link readDirection}
   */
  pull(given: Direction | string): void {
    this.node().siblings().pull(readDirection(given));
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
    this.node().align(
      readDirection(inDirection),
      readAlignment(newAlignmentMode)
    );
    if (newAlignmentMode != Alignment.NONE) {
      this.node().setNodeFit(Fit.EXACT);
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
      node = node.neighbors().nodeAt(readDirection(inDirection));
    }
    if (node) {
      node.setScale(SHRINK_SCALE);
    }
  }

  grow(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.neighbors().nodeAt(readDirection(inDirection));
    }
    if (node) {
      node.setScale(1.0);
    }
  }

  fitExact(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.neighbors().nodeAt(readDirection(inDirection));
    }
    node.setNodeFit(Fit.EXACT);
  }

  fitLoose(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.neighbors().nodeAt(readDirection(inDirection));
    }
    node.setNodeFit(Fit.LOOSE);
  }

  fitNaive(inDirection?: Direction | string): void {
    let node = this.node();
    if (inDirection) {
      node = node.neighbors().nodeAt(readDirection(inDirection));
    }
    node.setNodeFit(Fit.NAIVE);
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
    // Spawn a node in the given direction.
    const created = this.doSpawn(newType);
    this.node().connectNode(readDirection(inDirection), created);
    created.siblings().setLayoutPreference(PreferredAxis.PERPENDICULAR);
    created.setNodeFit(this.node().nodeFit());

    // Use the given alignment mode.
    if (newAlignmentMode !== undefined) {
      newAlignmentMode = readAlignment(newAlignmentMode);
      this.align(readDirection(inDirection), newAlignmentMode);
      if (newAlignmentMode !== Alignment.NONE) {
        this.node().setNodeFit(Fit.EXACT);
      }
    }

    return created;
  }

  /**
   * Replaces the current node's value with the given value.
   *
   * @param { Value | undefined } value - the new value. If undefined, then the value is removed.
   * @return { Value | undefined } the original value.
   */
  replace(value?: Value): Value | undefined {
    const oldVal = this.value();
    this.doReplace(this.node(), value);
    return oldVal;
  }

  value() {
    return this.node().value();
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
    if (this.node().neighbors().hasNode(readDirection(inDirection))) {
      return this.node().neighbors().nodeAt(readDirection(inDirection));
    }
    throw new Error("No node at direction");
  }

  id(val?: string | number) {
    if (arguments.length === 0) {
      return this.node().id();
    }
    this.node().setId(val);
  }
}
