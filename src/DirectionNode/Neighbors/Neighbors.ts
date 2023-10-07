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
    if (!fromNode) {
      // Clearing the parent.
      this._parentNeighbor = undefined;
      return;
    }
    if (parentDirection !== undefined) {
      this._parentNeighbor = fromNode.neighbors().at(parentDirection);
    }
    if (!this._parentNeighbor) {
      throw new Error("Parent neighbor not found");
    }
  }

  parent(): Neighbor {
    if (!this._parentNeighbor) {
      throw new Error("Node has no parent");
    }
    return this._parentNeighbor;
  }

  parentDirection(): Direction | undefined {
    if (this.isRoot()) {
      return undefined;
    }
    return reverseDirection(this.parent().direction());
  }

  parentNode(): DirectionNode {
    if (this.isRoot()) {
      throw new Error("Node has no parent");
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
    if (atDirection === undefined) {
      return false;
    }
    if (this.at(atDirection) && this.at(atDirection).neighbor()) {
      return true;
    }
    return !this.isRoot() && this.parent()?.reverseDirection() === atDirection;
  }

  hasNodes(axis: Axis): [Direction | undefined, Direction | undefined] {
    const result: [Direction | undefined, Direction | undefined] = [
      undefined,
      undefined,
    ];

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
    return this.hasNode(direction) && this.parentDirection() !== direction;
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

  lineLengthAt(direction: Direction): number {
    if (!this.hasNode(direction)) {
      return 0;
    }
    return this.at(direction).lineLength();
  }

  separationAt(inDirection: Direction): number {
    // Exclude some directions that cannot be calculated.
    if (!isCardinalDirection(inDirection)) {
      throw new Error("Direction for separation must be cardinal");
    }

    // If the given direction is the parent's direction, use
    // their measurement instead.
    if (!this.isRoot() && inDirection == this.parentDirection()) {
      return this.parentNode()
        .neighbors()
        .separationAt(reverseDirection(inDirection));
    }

    if (!this.node().neighbors().hasNode(inDirection)) {
      throw new Error("Node must have a child in the given direction");
    }

    return this.at(inDirection).separation();
  }

  getAlignment(inDirection: Direction): Alignment {
    if (this.hasNode(inDirection)) {
      return this.at(inDirection).getAlignment();
    }
    return Alignment.NULL;
  }

  private getParentDirection() {
    if (this.isRoot()) {
      throw new Error("Node has no parent");
    }
    const parentDir = this.parentDirection();
    if (undefined === parentDir) {
      throw new Error("Node is not root but has no parent direction");
    }
    return parentDir;
  }

  align(
    inDirection: Direction | Alignment,
    newAlignmentMode?: Alignment
  ): void {
    if (newAlignmentMode === undefined) {
      if (this.isRoot()) {
        throw new Error("Alignment must have a parent if self-directed");
      }
      return this.parentNode()
        .neighbors()
        .align(
          reverseDirection(this.getParentDirection()),
          inDirection as Alignment
        );
    }
    this.ensure(inDirection as Direction).align(newAlignmentMode);
    this.node().invalidate();
  }

  axisOverlap(inDirection?: Direction): AxisOverlap {
    if (inDirection === undefined) {
      if (this.isRoot()) {
        throw new Error(
          "Axis overlap must be set to a parent if no direction is given"
        );
      }
      return this.parentNode()
        .neighbors()
        .axisOverlap(reverseDirection(this.getParentDirection()));
    }
    if (this.hasNode(inDirection)) {
      return this.at(inDirection).axisOverlap();
    }
    return AxisOverlap.NULL;
  }

  setAxisOverlap(
    inDirection: Direction | AxisOverlap,
    newAxisOverlap?: AxisOverlap
  ): void {
    if (newAxisOverlap === undefined) {
      if (this.isRoot()) {
        throw new Error(
          "Axis overlap must be set to a parent if no direction is given"
        );
      }
      return this.parentNode()
        .neighbors()
        .setAxisOverlap(
          reverseDirection(this.getParentDirection()),
          inDirection as AxisOverlap
        );
    }
    this.ensure(inDirection as Direction).setAxisOverlap(newAxisOverlap);
    this.node().invalidate();
  }

  parentX(): number {
    if (this.isRoot()) {
      return 0;
    }
    return this.parent()?.xPos() ?? NaN;
  }

  parentY(): number {
    if (this.isRoot()) {
      return 0;
    }
    return this.parent()?.yPos() ?? NaN;
  }
}
