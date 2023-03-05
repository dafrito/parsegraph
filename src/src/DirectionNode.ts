import createException, {
  BAD_NODE_DIRECTION,
  BAD_LAYOUT_PREFERENCE,
  BAD_AXIS,
  NODE_IS_ROOT,
  CANNOT_AFFECT_PARENT,
  NO_NODE_FOUND,
  NO_OUTWARD_CONNECT,
  NO_PARENT_CONNECT,
  NOT_PAINT_GROUP,
} from "./Exception";

import Axis, {
  getNegativeDirection,
  getPositiveDirection,
  getDirectionAxis,
  isVerticalDirection,
} from "./Axis";

import Direction, {
  isCardinalDirection,
  NUM_DIRECTIONS,
  reverseDirection,
  HORIZONTAL_ORDER,
  VERTICAL_ORDER,
  forEachDirection,
} from "./Direction";

import { SiblingNode } from "./DirectionNodeSiblings";

import LayoutState from "./LayoutState";
import PreferredAxis from "./PreferredAxis";
import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";
import NeighborData from "./NeighborData";
import DirectionNodeSiblings from "./DirectionNodeSiblings";
import DirectionNodePaintGroup, {
  PaintGroupNode,
} from "./DirectionNodePaintGroup";
import DirectionNodeState from "./DirectionNodeState";

import { makeLimit } from "./utils";

export default class DirectionNode<Value = any> implements PaintGroupNode {
  _layoutPreference: PreferredAxis;
  _layoutState: LayoutState;

  _state: DirectionNodeState<Value, DirectionNode<Value>>;

  _neighbors: NeighborData<DirectionNode>[];
  _parentNeighbor: NeighborData<DirectionNode>;

  _siblings: DirectionNodeSiblings;
  _paintGroup: DirectionNodePaintGroup;
  _paintGroupRoot: DirectionNode;

  constructor() {
    this._layoutPreference = PreferredAxis.HORIZONTAL;
    this._layoutState = LayoutState.NEEDS_COMMIT;

    // Neighbors
    this._neighbors = new Array(NUM_DIRECTIONS);
    this._parentNeighbor = null;

    // Layout
    this._siblings = new DirectionNodeSiblings(this);
    this._paintGroupRoot = this;
    this._paintGroup = new DirectionNodePaintGroup(this, false);
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

  parentNeighbor(): NeighborData<DirectionNode> {
    return this._parentNeighbor;
  }

  parentDirection(): Direction {
    if (this.isRoot()) {
      return Direction.NULL;
    }
    return reverseDirection(this.parentNeighbor().direction);
  }

  nodeParent(): DirectionNode {
    if (this.isRoot()) {
      throw createException(NODE_IS_ROOT);
    }
    return this.parentNeighbor().owner as this;
  }

  parentNode(): DirectionNode {
    return this.nodeParent();
  }

  parent(): DirectionNode {
    return this.nodeParent();
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
    this._parentNeighbor = fromNode.neighborAt(parentDirection);
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
  // Layout order
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

  protected sanitizeLayoutPreference(given: PreferredAxis): PreferredAxis {
    const paxis = getDirectionAxis(this.parentDirection());
    if (given === PreferredAxis.VERTICAL) {
      given =
        paxis === Axis.VERTICAL
          ? PreferredAxis.PARENT
          : PreferredAxis.PERPENDICULAR;
    } else if (given === PreferredAxis.HORIZONTAL) {
      given =
        paxis === Axis.HORIZONTAL
          ? PreferredAxis.PARENT
          : PreferredAxis.PERPENDICULAR;
    }
    return given;
  }

  getLayoutPreference(): PreferredAxis {
    return this._layoutPreference;
  }

  canonicalLayoutPreference(): PreferredAxis {
    // Root nodes do not have a canonical layout preference.
    if (this.isRoot()) {
      throw createException(NODE_IS_ROOT);
    }

    // Convert the layout preference to either preferring the parent or
    // the perpendicular axis.
    let canonicalPref: PreferredAxis = this.getLayoutPreference();
    switch (this.getLayoutPreference()) {
      case PreferredAxis.HORIZONTAL: {
        if (getDirectionAxis(this.parentDirection()) === Axis.HORIZONTAL) {
          canonicalPref = PreferredAxis.PARENT;
        } else {
          canonicalPref = PreferredAxis.PERPENDICULAR;
        }
        break;
      }
      case PreferredAxis.VERTICAL: {
        if (getDirectionAxis(this.parentDirection()) === Axis.VERTICAL) {
          canonicalPref = PreferredAxis.PARENT;
        } else {
          canonicalPref = PreferredAxis.PERPENDICULAR;
        }
        break;
      }
      case PreferredAxis.PERPENDICULAR:
      case PreferredAxis.PARENT:
        canonicalPref = this.getLayoutPreference();
        break;
      case PreferredAxis.NULL:
        throw createException(BAD_LAYOUT_PREFERENCE);
    }
    return canonicalPref;
  }

  setLayoutPreference(given: PreferredAxis): void {
    if (this.isRoot()) {
      if (
        given !== PreferredAxis.VERTICAL &&
        given !== PreferredAxis.HORIZONTAL
      ) {
        throw createException(BAD_LAYOUT_PREFERENCE);
      }
      if (this.getLayoutPreference() === given) {
        return;
      }
      if (given === PreferredAxis.VERTICAL) {
        // PREFER_HORIZONTAL_AXIS -> PREFER_VERTICAL_AXIS
        this.siblings().horzToVert();
      } else {
        // PREFER_VERTICAL_AXIS -> PREFER_HORIZONTAL_AXIS
        this.siblings().vertToHorz();
      }
      this._layoutPreference = given;
      return;
    }

    given = this.sanitizeLayoutPreference(given);

    const curCanon = this.canonicalLayoutPreference();
    this._layoutPreference = given;
    const newCanon = this.canonicalLayoutPreference();
    if (curCanon === newCanon) {
      return;
    }

    const paxis = getDirectionAxis(this.parentDirection());
    if (curCanon === PreferredAxis.PARENT) {
      if (paxis === Axis.HORIZONTAL) {
        this.siblings().horzToVert();
      } else {
        this.siblings().vertToHorz();
      }
    } else {
      if (paxis === Axis.VERTICAL) {
        this.siblings().vertToHorz();
      } else {
        this.siblings().horzToVert();
      }
    }

    this.layoutChanged(Direction.INWARD);
  }

  pull(given: Direction): void {
    if (this.isRoot() || this.parentDirection() === Direction.OUTWARD) {
      if (isVerticalDirection(given)) {
        this.setLayoutPreference(PreferredAxis.VERTICAL);
      } else {
        this.setLayoutPreference(PreferredAxis.HORIZONTAL);
      }
      return;
    }
    if (getDirectionAxis(given) === getDirectionAxis(this.parentDirection())) {
      // console.log(namePreferredAxis(PreferredAxis.PARENT));
      this.setLayoutPreference(PreferredAxis.PARENT);
    } else {
      // console.log(namePreferredAxis(PreferredAxis.PERPENDICULAR);
      this.setLayoutPreference(PreferredAxis.PERPENDICULAR);
    }
  }

  layoutOrder(): Direction[] {
    if (this.isRoot()) {
      if (
        this.getLayoutPreference() === PreferredAxis.HORIZONTAL ||
        this.getLayoutPreference() === PreferredAxis.PERPENDICULAR
      ) {
        return HORIZONTAL_ORDER;
      }
      return VERTICAL_ORDER;
    }
    if (this.canonicalLayoutPreference() === PreferredAxis.PERPENDICULAR) {
      // console.log("PREFER PERP");
      if (getDirectionAxis(this.parentDirection()) === Axis.HORIZONTAL) {
        return VERTICAL_ORDER;
      }
      return HORIZONTAL_ORDER;
    }
    // console.log("PREFER PARALLEL TO PARENT: " +
    //   namePreferredAxis(this.getLayoutPreference()));
    // Parallel preference.
    if (getDirectionAxis(this.parentDirection()) === Axis.HORIZONTAL) {
      return HORIZONTAL_ORDER;
    }
    return VERTICAL_ORDER;
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
        return this.parentNeighbor().owner;
      }
      return null;
    }
    return n.node;
  }

  eachChild(
    visitor: (node: DirectionNode, dir: Direction) => void,
    visitorThisArg?: object
  ): void {
    const dirs = this.layoutOrder();
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

  localPaintGroup(): DirectionNodePaintGroup {
    return this._paintGroup;
  }

  paintGroup(): DirectionNodePaintGroup {
    if (!this._paintGroup) {
      const node = this.paintGroupRoot();
      if (!node || node === this) {
        return null;
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
          /* console.log(
            "Setting " +
              this.id() +
              " paint group to " +
              node.currentPaintGroup().id()
          );*/
          this.setPaintGroupRoot(node.paintGroupRoot());
          return this.paintGroupRoot();
        }
        node = node.parentNode();
      }
      this.setPaintGroupRoot(node);
    } else {
      // console.log("Returning cached paint group " +
      //   this.currentPaintGroup().id() +
      //   " for node " +
      //   this.id());
    }
    return this.paintGroupRoot();
  }

  pathToRoot(): PaintGroupNode[] {
    const nodes = [];
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

    // console.log("node path", nodePath.map(n=>n.id()));
    // console.log("other path", otherPath.map(n=>n.id()));
    // console.log("numCommon", numCommon);
    const lastCommonParent = nodePath[numCommon];
    // console.log("last common parent", lastCommonParent?.id());
    if (lastCommonParent === this) {
      return true;
    }
    if (lastCommonParent === other) {
      return false;
    }

    const paintOrdering = lastCommonParent.layoutOrder();

    const findPaintIndex = (nodes: PaintGroupNode[]) => {
      return paintOrdering.indexOf(
        reverseDirection(nodes[numCommon + 1].parentDirection())
      );
    };
    const nodePaintIndex = findPaintIndex(nodePath);
    const otherPaintIndex = findPaintIndex(otherPath);

    // console.log("Node index: ", nodePaintIndex, "Other index:", otherPaintIndex);

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
      // console.log("Nothing in common");
      return Infinity;
    }

    const rv = nodePath.length - numCommon + (otherPath.length - numCommon);
    // console.log("Distance from ", this.id(), "to", other.id(), ":", rv);
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
        // const node = paintGroupCandidates[index];
        // console.log("Testing", node.id());
        if (lowestDistanceIndex === -1) {
          // console.log(node.id(), "is first");
          return index;
        }

        if (candDistance <= paintGroupDistances[lowestDistanceIndex]) {
          // console.log(node.id(), "is closer or equidistant");
          return index;
        }

        // console.log(node.id(), "is not closer than ", paintGroupCandidates[lowestDistanceIndex].id());
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
    // console.log("Finding insert point for ", inserted.id());
    // console.log("Found last paint group of", paintGroupFirst.id(), ": ", paintGroupLast.id());

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
      //console.log("closest pg ", closestPaintGroup.id(), "comes before ", inserted.id(), "so insert at end");
      const endOfPaintGroup = closestPaintGroup.getLastPaintGroup();
      //console.log("end of pg", endOfPaintGroup.id());
      return [endOfPaintGroup, endOfPaintGroup.paintGroup().next()];
    }
    // console.log("closest pg ", closestPaintGroup.id(), "comes after ", inserted.id());
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
    // console.log("getLastPaintGroup starting with", candidate.id(), "prev", candidate.paintGroup().prev().id());
    const lim = makeLimit();
    while (candidate !== this) {
      if (!candidate.hasAncestor(this)) {
        const rv = candidate.paintGroup().prev();
        // console.log(candidate.id(), "is not ancestor of", this.id(), "so returning", rv.id());
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

  protected invalidateLayout(): void {
    this.setLayoutState(LayoutState.NEEDS_COMMIT);
  }

  setLayoutState(state: LayoutState) {
    this._layoutState = state;
  }

  layoutChanged(changeDirection?: Direction): void {
    // console.log("layoutChanged(" +
    //   (changeDirection != null ? nameDirection(
    //     changeDirection) : "null") +")")
    // Disallow null change directions.
    if (arguments.length === 0 || changeDirection === undefined) {
      changeDirection = Direction.INWARD;
    }
    if (changeDirection == Direction.NULL) {
      throw createException(BAD_NODE_DIRECTION);
    }

    let node: DirectionNode = this;
    while (node !== null) {
      // console.log("Node " + node + " has layout changed");
      const oldLayoutState = node.getLayoutState();

      // Set the needs layout flag.
      node.invalidateLayout();

      if (node.isRoot()) {
        break;
      } else if (oldLayoutState === LayoutState.COMMITTED) {
        // Notify our parent, if we were previously committed.
        node = node.nodeParent();
        changeDirection = reverseDirection(node.parentDirection());
      } else {
        break;
      }
    }
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
    // console.log("Connecting " + node + " to " + this + " in the " +
    //   nameDirection(inDirection) + " direction.");

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
      // console.log("Connecting local paint group ", node.id(), "to", pg.id());
      pg.paintGroup().append(node);
    } else {
      this.siblings().insertIntoLayout(inDirection);
      node.setPaintGroupRoot(this.paintGroupRoot());
      node.forEachNode((n) => n.setPaintGroupRoot(this.paintGroupRoot()));
      if (node.paintGroup().next() !== node) {
        const pg = this.findPaintGroup();
        pg.paintGroup().merge(node);
      }
      node._paintGroup = null;
    }

    this.layoutChanged(inDirection);

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
        nodes.push(this.disconnectNode(dir));
      }
    });
    return nodes;
  }

  disconnectNode(inDirection?: Direction): DirectionNode {
    if (arguments.length === 0) {
      if (this.isRoot()) {
        return this;
      }
      return this.parentNode().disconnectNode(
        reverseDirection(this.parentDirection())
      );
    }
    if (!this.hasNode(inDirection)) {
      return;
    }
    if (!this.isRoot() && this.parentDirection() === inDirection) {
      return this.parentNode().disconnectNode(
        reverseDirection(this.parentDirection())
      );
    }
    // Disconnect the node.
    // console.log("Disconnecting ", disconnected.id(), " from ", this.id());
    const neighbor = this.neighborAt(inDirection);
    const disconnected = neighbor.node as this;

    const clearExplicit = !disconnected.localPaintGroup();
    if (!disconnected.localPaintGroup()) {
      // console.log("Creasing for disconnect");
      disconnected.crease();
    }
    neighbor.node = null;
    disconnected.assignParent(null);
    disconnected.paintGroup().disconnect();

    if (clearExplicit) {
      disconnected.paintGroup().clearExplicit();
    }

    if (disconnected.getLayoutPreference() === PreferredAxis.PARENT) {
      if (Axis.VERTICAL === getDirectionAxis(inDirection)) {
        disconnected._layoutPreference = PreferredAxis.VERTICAL;
      } else {
        disconnected._layoutPreference = PreferredAxis.HORIZONTAL;
      }
    } else if (
      disconnected.getLayoutPreference() === PreferredAxis.PERPENDICULAR
    ) {
      if (Axis.VERTICAL === getDirectionAxis(inDirection)) {
        disconnected._layoutPreference = PreferredAxis.HORIZONTAL;
      } else {
        disconnected._layoutPreference = PreferredAxis.VERTICAL;
      }
    }
    this.layoutChanged(inDirection);

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
      neighbor.node = null;
    }, this);
    this.setLayoutState(LayoutState.NULL);
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

  value(): Value {
    return this.hasState() ? this.state().value() : null;
  }

  setValue(value: Value) {
    this.state().setValue(value);
  }

  getLayoutState(): LayoutState {
    return this._layoutState;
  }

  needsCommit(): boolean {
    return this.getLayoutState() === LayoutState.NEEDS_COMMIT;
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
    // console.log(nameNodeAlignment(newAlignmentMode));
    this.layoutChanged(inDirection as Direction);
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
    this.layoutChanged(inDirection as Direction);
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
    return this.parentNeighbor().xPos;
  }

  y(): number {
    if (this.isRoot()) {
      return 0;
    }
    return this.parentNeighbor().yPos;
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
      return this.nodeParent().separationAt(reverseDirection(inDirection));
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
