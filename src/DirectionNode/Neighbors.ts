import { NeighborData } from "./NeighborData";
import { Axis, Direction, getNegativeDirection, NUM_DIRECTIONS, getPositiveDirection } from "../Direction";
import createException, { BAD_NODE_DIRECTION, BAD_AXIS } from "../Exception";

export interface NeighborNode<T extends NeighborNode<T>> {
  neighbors(): Neighbors<T>;
}

export class Neighbors<T extends NeighborNode<T>> {
  private _node: T;
  private _neighbors: NeighborData<T>[];
  private _parentNeighbor: NeighborData<T> | undefined;

  constructor(node: T) {
      this._node = node;
      this._neighbors = new Array(NUM_DIRECTIONS);
  }

  assignParent(
    fromNode?: T,
    parentDirection?: Direction
  ): void {
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

  parent(): NeighborData<T> | undefined {
    return this._parentNeighbor;
  }

  node() {
    return this._node;
  }

  at(dir: Direction): NeighborData<T> {
    return this._neighbors[dir];
  }

  ensure(
    inDirection: Direction
  ): NeighborData<T> {
    if (!this.at(inDirection)) {
      this._neighbors[inDirection] = new NeighborData(this.node(), inDirection);
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
    return this.hasNode(direction) && this.parent()?.reverseDirection() !== direction;
  }

  hasChild(direction: Direction): boolean {
    return this.hasChildAt(direction);
  }

  hasAncestor(parent: T): boolean {
    let candidate: T | undefined = this.node();
    while (!candidate.neighbors().isRoot()) {
      if (candidate == parent) {
        return true;
      }
      candidate = candidate.neighbors().parent()?.node();
      if (!candidate) {
        throw new Error("node was not root but had no parent")
      }
    }
    return candidate == parent;
  }

  /**
   * Returns whether this DirectionNode has any non-parent neighbors in any direction.
   * 
   * @returns {boolean} true if this DirectionNode has any child neighbors in any direction.
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

  nodeAt(atDirection: Direction): T {
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

  destroy() {
    this._neighbors.forEach((neighbor) => {
      // Leave all neighbors
      neighbor.leave();
    });
  }

  root(): T {
    let p: T = this.node();
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

}