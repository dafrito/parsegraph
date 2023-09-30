import createException, {
  BAD_NODE_DIRECTION,
  BAD_AXIS,
  NODE_IS_ROOT,
  CANNOT_AFFECT_PARENT,
  NO_NODE_FOUND,
  NO_OUTWARD_CONNECT,
  NO_PARENT_CONNECT,
  NOT_PAINT_GROUP,
} from "../Exception";

import {
  Axis,
  getNegativeDirection,
  getPositiveDirection,
  getDirectionAxis,
  Direction,
  isCardinalDirection,
  NUM_DIRECTIONS,
  reverseDirection,
  forEachDirection,
} from "../Direction";

import { Layout } from "./Layout";

import { SiblingNode } from "./DirectionNodeSiblings";

import { LayoutPhase } from "./Layout";
import { PreferredAxis } from "./DirectionNodeSiblings";
import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";
import { NeighborData } from "./NeighborData";
import { DirectionNodeSiblings } from "./DirectionNodeSiblings";
import {
  DirectionNodePaintGroup,
  PaintGroupNode,
} from "./DirectionNodePaintGroup";
import { DirectionNodeState } from "./DirectionNodeState";

import makeLimit from "./makeLimit";

export class DirectionNode<Value = any> implements PaintGroupNode {
  _layout?: Layout;

  _state: DirectionNodeState<Value, DirectionNode<Value>>;

  _neighbors: NeighborData<DirectionNode>[];
  _parentNeighbor: NeighborData<DirectionNode> | null;

  _siblings: DirectionNodeSiblings;
  _paintGroup: DirectionNodePaintGroup | undefined;
  _paintGroupRoot: DirectionNode;

  constructor(value?: Value) {
    // Neighbors
    this._neighbors = new Array(NUM_DIRECTIONS);
    this._parentNeighbor = null;

    // Layout
    this._siblings = new DirectionNodeSiblings(this);
    this._paintGroupRoot = this;
    this._paintGroup = new DirectionNodePaintGroup(this, false);
    this._layout = undefined;

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

      if (node.isRoot()) {
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

  neighborAt(dir: Direction): NeighborData<DirectionNode> {
    return this._neighbors[dir];
  }

  protected createNeighborData(
    inDirection: Direction
  ): NeighborData<DirectionNode> {
    return new NeighborData<DirectionNode>(this, inDirection);
  }

  protected ensureNeighbor(
    inDirection: Direction
  ): NeighborData<DirectionNode> {
    if (!this.neighborAt(inDirection)) {
      this._neighbors[inDirection] = this.createNeighborData(inDirection);
    }
    return this.neighborAt(inDirection);
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Node parent
  //
  // ///////////////////////////////////////////////////////////////////////////

  parentNeighbor(): NeighborData<DirectionNode> | null {
    return this._parentNeighbor;
  }

  parentDirection(): Direction {
    if (!this._parentNeighbor) {
      return Direction.NULL;
    }
    return reverseDirection(this._parentNeighbor.direction);
  }

  parentNode(): DirectionNode {
    if (this.isRoot()) {
      throw createException(NODE_IS_ROOT);
    }
    return this.parentNeighbor()?.owner as this;
  }

  protected assignParent(
    fromNode?: DirectionNode,
    parentDirection?: Direction
  ): void {
    if (arguments.length === 0 || !fromNode) {
      // Clearing the parent.
      this._parentNeighbor = null;
      return;
    }
    if (parentDirection !== undefined) {
      this._parentNeighbor = fromNode.neighborAt(parentDirection);
    }
    if (!this._parentNeighbor) {
      throw createException(BAD_NODE_DIRECTION);
    }
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Node root
  //
  // ///////////////////////////////////////////////////////////////////////////

  root(): DirectionNode {
    let p: DirectionNode = this;
    while (!p.isRoot()) {
      p = p.parentNode();
    }
    return p;
  }

  isRoot(): boolean {
    return !this._parentNeighbor;
  }

  isRootlike(): boolean {
    return (
      this.isRoot() ||
      this.parentDirection() === Direction.INWARD ||
      this.parentDirection() === Direction.OUTWARD
    );
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Siblings
  //
  // ///////////////////////////////////////////////////////////////////////////

  siblings(): DirectionNodeSiblings {
    return this._siblings;
  }

  forEachNode(func: (node: SiblingNode) => void): void {
    let node: SiblingNode = this;
    do {
      func(node);
      node = node.siblings().prev();
    } while (node !== this);
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Graph traversal
  //
  // ///////////////////////////////////////////////////////////////////////////

  hasNode(atDirection: Direction): boolean {
    if (atDirection == Direction.NULL) {
      return false;
    }
    if (this.neighborAt(atDirection) && this.neighborAt(atDirection).node) {
      return true;
    }
    return !this.isRoot() && this.parentDirection() === atDirection;
  }

  hasNodes(axis: Axis): [Direction, Direction] {
    if (axis === Axis.NULL) {
      throw createException(BAD_AXIS, axis);
    }

    const result: [Direction, Direction] = [Direction.NULL, Direction.NULL];

    if (this.hasNode(getNegativeDirection(axis))) {
      result[0] = getNegativeDirection(axis);
    }
    if (this.hasNode(getPositiveDirection(axis))) {
      result[1] = getPositiveDirection(axis);
    }

    return result;
  }

  hasChildAt(direction: Direction): boolean {
    return this.hasNode(direction) && this.parentDirection() !== direction;
  }

  hasChild(direction: Direction): boolean {
    return this.hasChildAt(direction);
  }

  hasAnyNodes(): boolean {
    return (
      this.hasChildAt(Direction.DOWNWARD) ||
      this.hasChildAt(Direction.UPWARD) ||
      this.hasChildAt(Direction.FORWARD) ||
      this.hasChildAt(Direction.BACKWARD) ||
      this.hasChildAt(Direction.INWARD)
    );
  }

  nodeAt(atDirection: Direction): DirectionNode {
    const n = this.neighborAt(atDirection);
    if (!n) {
      if (this.parentNeighbor() && this.parentDirection() === atDirection) {
        const owner = this.parentNeighbor()?.owner;
        if (!owner) {
          throw new Error("Parent neighbor has no owner");
        }
        return owner;
      }
      return undefined as any;
      // throw new Error("Node not found");
    }
    if (!n.node) {
      throw new Error("No node for neighbor");
    }
    return n.node;
  }

  eachChild(
    visitor: (node: DirectionNode, dir: Direction) => void,
    visitorThisArg?: object
  ): void {
    const dirs = this.siblings().layoutOrder();
    for (let i = 0; i < dirs.length; ++i) {
      const dir = dirs[i];
      if (!this.isRoot() && dir === this.parentDirection()) {
        continue;
      }
      const node = this.nodeAt(dir);
      if (node) {
        visitor.call(visitorThisArg, node, dir);
      }
    }
  }

  hasAncestor(parent: DirectionNode): boolean {
    let candidate: DirectionNode = this;
    while (!candidate.isRoot()) {
      if (candidate == parent) {
        return true;
      }
      candidate = candidate.parentNode();
    }
    return candidate == parent;
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Paint groups
  //
  // ///////////////////////////////////////////////////////////////////////////

  localPaintGroup(): DirectionNodePaintGroup | undefined {
    return this._paintGroup;
  }

  paintGroup(): DirectionNodePaintGroup {
    if (!this._paintGroup) {
      const node = this.paintGroupRoot();
      if (!node || node === this) {
        throw new Error("Paint group is null");
      }
      return node.paintGroup();
    }
    return this._paintGroup;
  }

  forEachPaintGroup(func: (node: PaintGroupNode) => void): void {
    let node: PaintGroupNode = this;
    do {
      if (!node.paintGroup()) {
        throw createException(NOT_PAINT_GROUP);
      }
      func(node);
      node = node.paintGroup().prev();
    } while (node !== this);
  }

  findPaintGroup(): DirectionNode {
    if (!this.paintGroupRoot()) {
      let node: DirectionNode = this;
      while (!node.isRoot()) {
        if (node.localPaintGroup()) {
          break;
        }
        if (node.paintGroupRoot()) {
          this.setPaintGroupRoot(node.paintGroupRoot());
          return this.paintGroupRoot();
        }
        node = node.parentNode();
      }
      this.setPaintGroupRoot(node);
    }
    return this.paintGroupRoot();
  }

  pathToRoot(): PaintGroupNode[] {
    const nodes: DirectionNode[] = [];
    let n: DirectionNode = this;

    const lim = makeLimit();
    while (!n.isRoot()) {
      nodes.push(n);
      n = n.parentNode();
      lim();
    }

    // Push root, too.
    nodes.push(n);

    return nodes;
  }

  comesBefore(other: PaintGroupNode): boolean {
    if (this === other) {
      return false;
    }
    if (this.isRoot()) {
      // Root comes before all nodes.
      return true;
    }
    if (other.isRoot()) {
      // If we are not root, but other is, then other
      // is assumed to come after us.
      return false;
    }

    const nodePath = this.pathToRoot().reverse();
    const otherPath = other.pathToRoot().reverse();

    // Find count in common
    let numCommon = 0;
    for (
      numCommon = 0;
      numCommon < Math.min(otherPath.length, nodePath.length);
      ++numCommon
    ) {
      if (otherPath[numCommon] !== nodePath[numCommon]) {
        break;
      }
    }
    --numCommon;

    if (numCommon < 0) {
      return false;
    }

    const lastCommonParent = nodePath[numCommon];
    if (lastCommonParent === this) {
      return true;
    }
    if (lastCommonParent === other) {
      return false;
    }

    const paintOrdering = lastCommonParent.siblings().layoutOrder();

    const findPaintIndex = (nodes: PaintGroupNode[]) => {
      return paintOrdering.indexOf(
        reverseDirection(nodes[numCommon + 1].parentDirection())
      );
    };
    const nodePaintIndex = findPaintIndex(nodePath);
    const otherPaintIndex = findPaintIndex(otherPath);

    return nodePaintIndex < otherPaintIndex;
  }

  comesAfter(other: DirectionNode): boolean {
    if (this === other) {
      return false;
    }
    return !this.comesBefore(other);
  }

  findDistance(other: PaintGroupNode): number {
    if (this === other) {
      return 0;
    }
    const nodePath = this.pathToRoot().reverse();
    const otherPath = other.pathToRoot().reverse();

    // Find count in common
    let numCommon = 0;
    for (
      numCommon = 0;
      numCommon < Math.min(otherPath.length, nodePath.length);
      ++numCommon
    ) {
      if (otherPath[numCommon] !== nodePath[numCommon]) {
        break;
      }
    }

    if (numCommon === 0) {
      return Infinity;
    }

    const rv = nodePath.length - numCommon + (otherPath.length - numCommon);
    return rv;
  }

  findClosestPaintGroup(
    inserted: PaintGroupNode,
    paintGroupCandidates: PaintGroupNode[]
  ) {
    // Compute distances from the inserted node
    const paintGroupDistances = paintGroupCandidates.map((candidateNode) =>
      inserted.findDistance(candidateNode)
    );

    const closestPaintGroupIndex = paintGroupDistances.reduce(
      (lowestDistanceIndex, candDistance, index) => {
        if (lowestDistanceIndex === -1) {
          return index;
        }

        if (candDistance <= paintGroupDistances[lowestDistanceIndex]) {
          return index;
        }

        return lowestDistanceIndex;
      },
      -1
    );

    return paintGroupCandidates[closestPaintGroupIndex];
  }

  findPaintGroupInsert(
    inserted: PaintGroupNode
  ): [PaintGroupNode, PaintGroupNode] {
    if (!this.localPaintGroup()) {
      return this.paintGroup().node().findPaintGroupInsert(inserted);
    }

    // Gather possible insertion points; exclude this node.
    const paintGroupCandidates: PaintGroupNode[] = [];
    const lim = makeLimit();
    let n = this.paintGroup().next();
    while (n !== this) {
      paintGroupCandidates.push(n);
      lim();
      n = n.paintGroup().next();
    }
    paintGroupCandidates.push(this.getLastPaintGroup());

    const closestPaintGroup = this.findClosestPaintGroup(
      inserted,
      paintGroupCandidates
    );

    if (closestPaintGroup.comesBefore(inserted)) {
      const endOfPaintGroup = closestPaintGroup.getLastPaintGroup();
      return [endOfPaintGroup, endOfPaintGroup.paintGroup().next()];
    }
    return [closestPaintGroup.paintGroup().prev(), closestPaintGroup];
  }

  /**
   * Finds the last paint group to be painted and rendered
that is still a descendent of this node.
   *
   * @return {this} The first paint group to be drawn that is a child of this paint group.
   */
  getLastPaintGroup(): PaintGroupNode {
    let candidate: PaintGroupNode = this.localPaintGroup()
      ? this.paintGroup().next()
      : this;
    const lim = makeLimit();
    while (candidate !== this) {
      if (!candidate.hasAncestor(this)) {
        const rv = candidate.paintGroup().prev();
        return rv;
      }
      candidate = candidate.paintGroup().next();
      lim();
    }
    return candidate === this ? candidate.paintGroup().prev() : candidate;
  }

  paintGroupRoot(): DirectionNode {
    return this._paintGroupRoot;
  }

  crease() {
    if (this.localPaintGroup()) {
      this.paintGroup().crease();
    } else {
      this._paintGroup = new DirectionNodePaintGroup(this, true);
    }
  }

  uncrease() {
    if (this.paintGroup()) {
      this.paintGroup().uncrease();
    }
  }

  setPaintGroupRoot(pg: DirectionNode) {
    if (!pg) {
      throw new Error("Refusing to set paint group root to null");
    }
    this._paintGroupRoot = pg;
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

  connectNode<T>(
    inDirection: Direction,
    node: DirectionNode<T>
  ): DirectionNode<T> {
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
    if (this.hasNode(inDirection)) {
      this.disconnectNode(inDirection);
    }
    if (!node.isRoot()) {
      node.disconnectNode();
    }
    if (node.hasNode(reverseDirection(inDirection))) {
      node.disconnectNode(reverseDirection(inDirection));
    }

    // Connect the node.
    const neighbor = this.ensureNeighbor(inDirection);
    // Allow alignments to be set before children are spawned.
    if (neighbor.alignmentMode == Alignment.NULL) {
      neighbor.alignmentMode = Alignment.NONE;
    }
    neighbor.node = node;
    node.assignParent(this, inDirection);

    if (node.paintGroup().explicit()) {
      const pg = this.findPaintGroup();
      pg.paintGroup().append(node);
    } else {
      this.siblings().insertIntoLayout(inDirection);
      node.setPaintGroupRoot(this.paintGroupRoot());
      node.forEachNode((n) => n.setPaintGroupRoot(this.paintGroupRoot()));
      if (node.paintGroup().next() !== node) {
        const pg = this.findPaintGroup();
        pg.paintGroup().merge(node);
      }
      node._paintGroup = undefined;
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
      if (this.hasNode(dir)) {
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
      if (this.isRoot()) {
        return this;
      }
      return this.parentNode().disconnectNode(
        reverseDirection(this.parentDirection())
      );
    }

    if (!this.hasNode(inDirection)) {
      return undefined;
    }

    if (!this.isRoot() && this.parentDirection() === inDirection) {
      return this.parentNode().disconnectNode(
        reverseDirection(this.parentDirection())
      );
    }
    // Disconnect the node.
    const neighbor = this.neighborAt(inDirection);
    const disconnected = neighbor.node as this;

    const clearExplicit = !disconnected.localPaintGroup();
    if (!disconnected.localPaintGroup()) {
      disconnected.crease();
    }
    neighbor.node = undefined;
    disconnected.assignParent(undefined);
    disconnected.paintGroup().disconnect();

    if (clearExplicit) {
      disconnected.paintGroup().clearExplicit();
    }

    if (
      disconnected.siblings().getLayoutPreference() === PreferredAxis.PARENT
    ) {
      if (Axis.VERTICAL === getDirectionAxis(inDirection)) {
        disconnected.siblings()._layoutPreference = PreferredAxis.VERTICAL;
      } else {
        disconnected.siblings()._layoutPreference = PreferredAxis.HORIZONTAL;
      }
    } else if (
      disconnected.siblings().getLayoutPreference() ===
      PreferredAxis.PERPENDICULAR
    ) {
      if (Axis.VERTICAL === getDirectionAxis(inDirection)) {
        disconnected.siblings()._layoutPreference = PreferredAxis.HORIZONTAL;
      } else {
        disconnected.siblings()._layoutPreference = PreferredAxis.VERTICAL;
      }
    }
    this.layoutChanged();

    return disconnected;
  }

  eraseNode(givenDirection: Direction): void {
    if (!this.hasNode(givenDirection)) {
      return;
    }
    if (!this.isRoot() && givenDirection == this.parentDirection()) {
      throw createException(CANNOT_AFFECT_PARENT);
    }
    this.disconnectNode(givenDirection);
  }

  destroy(): void {
    if (!this.isRoot()) {
      this.disconnectNode();
    }
    this._neighbors.forEach(function (neighbor): void {
      // Clear all children.
      neighbor.node = undefined;
    }, this);
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
    this.state().setValue(value);
  }

  nodeAlignmentMode(inDirection: Direction): Alignment {
    if (this.hasNode(inDirection)) {
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
    this.ensureNeighbor(inDirection as Direction).alignmentMode =
      newAlignmentMode;
    this.layoutChanged();
  }

  axisOverlap(inDirection?: Direction): AxisOverlap {
    if (inDirection === undefined) {
      return this.parentNode().axisOverlap(
        reverseDirection(this.parentDirection())
      );
    }
    if (this.hasNode(inDirection)) {
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
    this.ensureNeighbor(inDirection as Direction).allowAxisOverlap =
      newAxisOverlap;
    this.layoutChanged();
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Position
  //
  // ///////////////////////////////////////////////////////////////////////////

  x(): number {
    if (this.isRoot()) {
      return 0;
    }
    return this.parentNeighbor()?.xPos ?? NaN;
  }

  y(): number {
    if (this.isRoot()) {
      return 0;
    }
    return this.parentNeighbor()?.yPos ?? NaN;
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
    if (!this.isRoot() && inDirection == this.parentDirection()) {
      return this.parentNode().separationAt(reverseDirection(inDirection));
    }

    if (!this.hasNode(inDirection)) {
      throw createException(NO_NODE_FOUND);
    }

    return this.neighborAt(inDirection).separation;
  }

  lineLengthAt(direction: Direction): number {
    if (!this.hasNode(direction)) {
      return 0;
    }
    return this.neighborAt(direction).lineLength;
  }

  // ///////////////////////////////////////////////////////////////////////////
  //
  // Debugging
  //
  // ///////////////////////////////////////////////////////////////////////////

  toString(): string {
    return `[DirectionNode ${
      this.hasState() ? this.state().toString() : "<no state>"
    }]`;
  }
}
