import { Neighbor } from "./Neighbor";
import {
  Axis,
  Direction,
  getNegativeDirection,
  NUM_DIRECTIONS,
  getPositiveDirection,
  isCardinalDirection,
  reverseDirection,
} from "../Direction";
import createException, { BAD_NODE_DIRECTION, BAD_AXIS, NO_NODE_FOUND } from "../Exception";
import { DirectionNode } from "./DirectionNode";

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

  parent(): Neighbor | undefined {
    return this._parentNeighbor;
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
    return (
      this.hasNode(direction) && this.parent()?.reverseDirection() !== direction
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
      if (this.parent()?.reverseDirection() === atDirection) {
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
 
  separationAt(inDirection: Direction): number {
    // Exclude some directions that cannot be calculated.
    if (!isCardinalDirection(inDirection)) {
      throw createException(BAD_NODE_DIRECTION);
    }

    // If the given direction is the parent's direction, use
    // their measurement instead.
    if (!this.isRoot() && inDirection == this.node().parentDirection()) {
      return this.node().parentNode().neighbors().separationAt(reverseDirection(inDirection));
    }

    if (!this.node().neighbors().hasNode(inDirection)) {
      throw createException(NO_NODE_FOUND);
    }

    return this.at(inDirection).separation;
  }
}
