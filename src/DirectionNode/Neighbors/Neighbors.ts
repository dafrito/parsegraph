import { Neighbor } from "./Neighbor";
import {
  Axis,
  Direction,
  getNegativeDirection,
  NUM_DIRECTIONS,
  getPositiveDirection,
  isCardinalDirection,
  reverseDirection,
} from "../../Direction";
import createException, {
  BAD_NODE_DIRECTION,
  BAD_AXIS,
  NO_NODE_FOUND,
  NODE_IS_ROOT,
} from "../../Exception";
import { DirectionNode } from "../DirectionNode";
import { Alignment } from "./Alignment";
import { AxisOverlap } from "./AxisOverlap";

export class Neighbors {
  private _node: DirectionNode;
  private _neighbors: Neighbor[];
  private _parentNeighbor: Neighbor | undefined;

  constructor(node: DirectionNode) {
    this._node = node;
    this._neighbors = new Array(NUM_DIRECTIONS);
  }

  assignParent(fromNode?: DirectionNode, parentDirection?: Direction): void {
    if (arguments.length === 0 || !fromNode) {
      // Clearing the parent.
      this._parentNeighbor = undefined;
      return;
    }
    if (parentDirection !== undefined) {
      this._parentNeighbor = fromNode.neighbors().at(parentDirection);
    }
    if (!this._parentNeighbor) {
      throw createException(BAD_NODE_DIRECTION);
    }
  }

  parent(): Neighbor {
    if (!this._parentNeighbor) {
      throw createException(NODE_IS_ROOT);
    }
    return this._parentNeighbor;
  }

  parentDirection(): Direction {
    if (this.isRoot()) {
      return Direction.NULL;
    }
    return reverseDirection(this.parent().direction());
  }

  parentNode(): DirectionNode {
    if (this.isRoot()) {
      throw createException(NODE_IS_ROOT);
    }
    return this.parent().node();
  }

  node() {
    return this._node;
  }

  at(dir: Direction): Neighbor {
    return this._neighbors[dir];
  }

  ensure(inDirection: Direction): Neighbor {
    if (!this.at(inDirection)) {
      this._neighbors[inDirection] = new Neighbor(this.node(), inDirection);
    }
    return this.at(inDirection);
  }

  hasNode(atDirection: Direction): boolean {
    if (atDirection == Direction.NULL) {
      return false;
    }
    if (this.at(atDirection) && this.at(atDirection).neighbor()) {
      return true;
    }
    return !this.isRoot() && this.parent()?.reverseDirection() === atDirection;
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
    if (this.isRoot()) {
      return this.hasNode(direction);
    }
    return (
      this.hasNode(direction) && this.parentDirection() !== direction
    );
  }

  hasChild(direction: Direction): boolean {
    return this.hasChildAt(direction);
  }

  hasAncestor(parent: DirectionNode): boolean {
    let candidate: DirectionNode | undefined = this.node();
    while (!candidate.neighbors().isRoot()) {
      if (candidate == parent) {
        return true;
      }
      candidate = candidate.neighbors().parent()?.node();
      if (!candidate) {
        throw new Error("node was not root but had no parent");
      }
    }
    return candidate == parent;
  }

  /**
   * Returns whether this DirectionNode has any non-parent neighbors in any direction.
   *
   * @return {boolean} true if this DirectionNode has any child neighbors in any direction.
   *
   * @see {@link hasChildAt}
   */
  hasAnyNeighbors(): boolean {
    return (
      this.hasChildAt(Direction.DOWNWARD) ||
      this.hasChildAt(Direction.UPWARD) ||
      this.hasChildAt(Direction.FORWARD) ||
      this.hasChildAt(Direction.BACKWARD) ||
      this.hasChildAt(Direction.INWARD)
    );
  }

  nodeAt(atDirection: Direction): DirectionNode {
    const n = this.at(atDirection);
    if (!n) {
      if (!this.isRoot() && this.parent().reverseDirection() === atDirection) {
        const par = this.parent()?.node();
        if (!par) {
          throw new Error("Parent neighbor has no node");
        }
        return par;
      }
      return undefined as any;
      // throw new Error("Node not found");
    }
    const node = n.neighbor();
    if (!node) {
      throw new Error("No node for neighbor");
    }
    return node;
  }

  root(): DirectionNode {
    let p: DirectionNode = this.node();
    while (!p.neighbors().isRoot()) {
      const par = p.neighbors().parent()?.node();
      if (!par) {
        break;
      }
      p = par;
    }
    return p;
  }

  isRoot(): boolean {
    return !this._parentNeighbor;
  }

  isRootlike(): boolean {
    return (
      this.isRoot() ||
      this.parent()?.direction() === Direction.INWARD ||
      this.parent()?.direction() === Direction.OUTWARD
    );
  }

  setPosAt(inDirection: Direction, x: number, y: number): void {
    this.at(inDirection).xPos = x;
    this.at(inDirection).yPos = y;
  }

  lineLengthAt(direction: Direction): number {
    if (!this.hasNode(direction)) {
      return 0;
    }
    return this.at(direction).lineLength;
  }

  separationAt(inDirection: Direction): number {
    // Exclude some directions that cannot be calculated.
    if (!isCardinalDirection(inDirection)) {
      throw createException(BAD_NODE_DIRECTION);
    }

    // If the given direction is the parent's direction, use
    // their measurement instead.
    if (!this.isRoot() && inDirection == this.parentDirection()) {
      return this.parentNode()
        .neighbors()
        .separationAt(reverseDirection(inDirection));
    }

    if (!this.node().neighbors().hasNode(inDirection)) {
      throw createException(NO_NODE_FOUND);
    }

    return this.at(inDirection).separation;
  }

  getAlignment(inDirection: Direction): Alignment {
    if (this.hasNode(inDirection)) {
      return this.at(inDirection).alignmentMode;
    }
    return Alignment.NULL;
  }

  align(
    inDirection: Direction | Alignment,
    newAlignmentMode?: Alignment
  ): void {
    if (newAlignmentMode === undefined) {
      return this.parentNode().neighbors().align(
        reverseDirection(this.parentDirection()),
        inDirection as Alignment
      );
    }
    this.ensure(inDirection as Direction).alignmentMode =
      newAlignmentMode;
    this.node().invalidate();
  }

  axisOverlap(inDirection?: Direction): AxisOverlap {
    if (inDirection === undefined) {
      return this.parentNode().neighbors().axisOverlap(
        reverseDirection(this.parentDirection())
      );
    }
    if (this.hasNode(inDirection)) {
      return this.at(inDirection).allowAxisOverlap;
    }
    return AxisOverlap.NULL;
  }

  setAxisOverlap(
    inDirection: Direction | AxisOverlap,
    newAxisOverlap?: AxisOverlap
  ): void {
    if (newAxisOverlap === undefined) {
      return this.parentNode().neighbors().setAxisOverlap(
        reverseDirection(this.parentDirection()),
        inDirection as AxisOverlap
      );
    }
    this.ensure(inDirection as Direction).allowAxisOverlap =
      newAxisOverlap;
    this.node().invalidate();
  }

}
