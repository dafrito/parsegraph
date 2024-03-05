import {
  Direction,
  isVerticalDirection,
  getDirectionAxis,
  Axis,
} from "../../Direction";
import { PreferredAxis } from "./PreferredAxis";
import { DirectionNode } from "../DirectionNode";

const MAX_SIBLINGS = 100000;

const HORIZONTAL_ORDER: Direction[] = [
  Direction.INWARD,
  Direction.BACKWARD,
  Direction.FORWARD,
  Direction.DOWNWARD,
  Direction.UPWARD,
  Direction.OUTWARD,
];

const VERTICAL_ORDER: Direction[] = [
  Direction.INWARD,
  Direction.DOWNWARD,
  Direction.UPWARD,
  Direction.BACKWARD,
  Direction.FORWARD,
  Direction.OUTWARD,
];

/**
 * Represents a DirectionNode's entry within its paint group.
 *
 * Every DirectionNode has its own Siblings instance.
 *
 * Siblings are often used to iterate all nodes in the graph, using forEach.
 * Siblings are also used to store the preferred axis of a node, as this affects
 * the layout and iteration order of the node's children.
 *
 * @see PreferredAxis
 *
 */
export class Siblings {
  private _prev: DirectionNode;
  private _next: DirectionNode;
  private _node: DirectionNode;
  private _layoutPreference: PreferredAxis;

  /**
   * Creates a new, orphaned Siblings object for this node with
   * a horizontal preferred axis.
   *
   * @param {DirectionNode} node the owning node
   */
  constructor(node: DirectionNode) {
    this._node = node;
    this._prev = this._node;
    this._next = this._node;
    this._layoutPreference = PreferredAxis.HORIZONTAL;
  }

  /**
   * Iterates over every node in this node's paint group, beginning with this
   * node and continuing until all nodes are iterated.
   *
   * @param {function} func the iterator that will be called for each node in this node's paint group.
   * The iterator's signature is <code>(node: DirectionNode) => void</code>
   */
  forEach(func: (node: DirectionNode) => void): void {
    let node: DirectionNode = this.node();
    do {
      func(node);
      node = node.siblings().prev();
    } while (node !== this.node());
  }

  node() {
    return this._node;
  }

  /**
   * Test method to ensure the Siblings object can be iterated.
   */
  verify() {
    let count = 0;
    for (let n = this.next(); n !== this.node(); n = n.siblings().next()) {
      if (count > MAX_SIBLINGS) {
        throw new Error();
      }
      ++count;
    }
  }

  removeFromLayout(inDirection: Direction): void {
    const disconnected: DirectionNode = this.node()
      .neighbors()
      .nodeAt(inDirection);
    if (!disconnected) {
      return;
    }
    const layoutBefore: DirectionNode = this.node()
      .siblings()
      .earlier(inDirection);
    const earliestDisc: DirectionNode = disconnected
      .siblings()
      .head(disconnected);

    if (layoutBefore) {
      this.connect(layoutBefore, disconnected.siblings().next());
    } else {
      this.connect(
        earliestDisc.siblings().prev(),
        disconnected.siblings().next()
      );
    }
    this.connect(disconnected, earliestDisc);
    this.verify();
    disconnected.siblings().verify();
  }

  private connect(a: DirectionNode, b: DirectionNode): void {
    // console.log("connecting " +  a.id() + " to " + b.id());
    a.siblings()._next = b;
    b.siblings()._prev = a;
  }

  insertIntoLayout(inDirection: Direction): void {
    const node: DirectionNode = this.node().neighbors().nodeAt(inDirection);
    if (!node) {
      return;
    }

    const nodeHead: DirectionNode = node.siblings().head();

    const layoutAfter: DirectionNode = this.node()
      .siblings()
      .later(inDirection);
    const layoutBefore: DirectionNode = this.node()
      .siblings()
      .earlier(inDirection);

    const nodeTail: DirectionNode = node;
    // console.log(this + ".connect(" + nameDirection(inDirection) +
    //   ", " + node + ") layoutBefore=" +
    //   layoutBefore + " layoutAfter=" +
    //   layoutAfter + " nodeHead=" + nodeHead);

    if (layoutBefore) {
      this.connect(layoutBefore, nodeHead);
    } else if (layoutAfter) {
      this.connect(layoutAfter.siblings().head().siblings().prev(), nodeHead);
    } else {
      this.connect(this.prev(), nodeHead);
    }

    if (layoutAfter) {
      this.connect(nodeTail, layoutAfter.siblings().head());
    } else {
      this.connect(nodeTail, this.node());
    }
    this.verify();
  }

  next(): DirectionNode {
    return this._next;
  }

  prev(): DirectionNode {
    return this._prev;
  }

  head(excludeThisNode?: DirectionNode): DirectionNode {
    let deeplyLinked: DirectionNode = this.node();
    let foundOne;
    while (true) {
      foundOne = false;
      const dirs = deeplyLinked.siblings().layoutOrder();
      for (let i = 0; i < dirs.length; ++i) {
        const dir = dirs[i];
        const candidate = deeplyLinked.neighbors().hasNode(dir)
          ? deeplyLinked.neighbors().nodeAt(dir)
          : undefined;
        if (
          candidate &&
          candidate != excludeThisNode &&
          deeplyLinked.neighbors().parent()?.reverseDirection() !== dir &&
          !candidate.paintGroups().isPaintGroup()
        ) {
          deeplyLinked = candidate;
          foundOne = true;
          break;
        }
      }
      if (!foundOne) {
        break;
      }
    }
    return deeplyLinked;
  }

  earlier(inDirection: Direction): DirectionNode {
    let layoutBefore;
    const dirs = this.node().siblings().layoutOrder();
    let pastDir = false;
    for (let i = dirs.length - 1; i >= 0; --i) {
      const dir = dirs[i];
      if (dir === inDirection) {
        pastDir = true;
        continue;
      }
      if (!pastDir) {
        continue;
      }
      if (
        !this.node().neighbors().isRoot() &&
        dir === this.node().neighbors().parent()?.reverseDirection()
      ) {
        continue;
      }
      if (this.node().neighbors().hasNode(dir)) {
        const candidate = this.node().neighbors().nodeAt(dir);
        if (candidate && !candidate.paintGroups().isPaintGroup()) {
          layoutBefore = candidate;
          break;
        }
      }
    }
    return layoutBefore;
  }

  later(inDirection: Direction): DirectionNode {
    let layoutAfter;
    const dirs = this.node().siblings().layoutOrder();
    let pastDir = false;
    for (let i = 0; i < dirs.length; ++i) {
      const dir = dirs[i];
      // console.log(nameDirection(dir) + " pastDir=" + pastDir);
      if (dir === inDirection) {
        pastDir = true;
        continue;
      }
      if (!pastDir) {
        continue;
      }
      if (
        !this.node().neighbors().isRoot() &&
        dir === this.node().neighbors().parent()?.reverseDirection()
      ) {
        continue;
      }
      if (this.node().neighbors().hasNode(dir)) {
        const candidate = this.node().neighbors().nodeAt(dir);
        if (candidate && !candidate.paintGroups().isPaintGroup()) {
          layoutAfter = candidate;
          break;
        }
      }
    }
    return layoutAfter;
  }

  horzToVert() {
    const parentDir = this.node().neighbors().isRoot()
      ? null
      : this.node().neighbors().parentDirection();
    const b =
      parentDir === Direction.BACKWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.BACKWARD);
    const f =
      parentDir === Direction.FORWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.FORWARD);
    const u =
      parentDir === Direction.UPWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.UPWARD);
    const d =
      parentDir === Direction.DOWNWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.DOWNWARD);
    let firstHorz = b || f;
    if (firstHorz) {
      firstHorz = firstHorz.siblings().head();
    }
    const lastHorz = f || b;
    let firstVert = d || u;
    if (firstVert) {
      firstVert = firstVert.siblings().head();
    }
    const lastVert = u || d;
    if (!firstHorz || !firstVert) {
      return;
    }

    // Convert horizontal layout to vertical.
    // Expected: [b, f, d, u, bud]
    // Before: [d, u, b, f, bud]

    const firstHorzPrev = firstHorz.siblings().prev();
    if (!lastVert) {
      throw new Error("Undefined siblings");
    }
    const lastVertNext = lastVert.siblings().next();
    if (!lastVert || !lastHorz || !lastVertNext) {
      throw new Error("Undefined siblings");
    }
    this.connect(firstHorzPrev, firstVert);
    this.connect(lastHorz, lastVertNext);
    this.connect(lastVert, firstHorz);
    this.verify();
  }

  vertToHorz() {
    const parentDir = this.node().neighbors().isRoot()
      ? null
      : this.node().neighbors().parentDirection();
    const b =
      parentDir === Direction.BACKWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.BACKWARD);
    const f =
      parentDir === Direction.FORWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.FORWARD);
    const u =
      parentDir === Direction.UPWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.UPWARD);
    const d =
      parentDir === Direction.DOWNWARD
        ? null
        : this.node().neighbors().nodeAt(Direction.DOWNWARD);

    let firstHorz = b || f;
    if (firstHorz) {
      firstHorz = firstHorz.siblings().head();
    }
    const lastHorz = f || b;
    let firstVert = d || u;
    if (firstVert) {
      firstVert = firstVert.siblings().head();
    }
    const lastVert = u || d;
    if (!firstHorz || !firstVert) {
      return;
    }

    if (!lastVert || !lastHorz) {
      throw new Error("Undefined siblings");
    }

    // Convert vertical layout to horizontal.
    // Before: [d, u, b, f, bud]
    // Expected: [b, f, d, u, bud]

    // Connect the node previous to the first, to the first horizontal node.
    this.connect(firstVert.siblings().prev(), firstHorz);

    // Connect last vertical to the current last horizontal's next node.
    this.connect(lastVert, lastHorz.siblings().next());

    // Then take the last horizontal, which is now pointing to the same node
    // and connect it to the first vertical.
    this.connect(lastHorz, firstVert);

    this.verify();
  }

  dump(): DirectionNode[] {
    const nodes: DirectionNode[] = [];
    let node: DirectionNode = this.node();
    do {
      node = node.siblings().next();
      nodes.push(node);
    } while (node !== this.node());
    return nodes;
  }

  protected sanitizeLayoutPreference(given: PreferredAxis): PreferredAxis {
    const parentDir = this.node().neighbors().parent()?.direction();
    if (parentDir === undefined) {
      throw new Error("Cannot sanitize root layout preference");
    }
    const paxis = getDirectionAxis(parentDir);
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

  convertLayoutPreference(inDirection: Direction): void {
    const disconnected = this.node();
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
  }

  canonicalLayoutPreference(): PreferredAxis {
    if (this.node().neighbors().isRoot()) {
      throw new Error("Root nodes do not have a canonical layout preference");
    }

    const parentDir = this.node().neighbors().parent()?.direction();
    if (parentDir === undefined) {
      throw new Error("Node is not root but has no parent");
    }

    // Convert the layout preference to either preferring the parent or
    // the perpendicular axis.
    let canonicalPref: PreferredAxis = this.getLayoutPreference();
    switch (this.getLayoutPreference()) {
      case PreferredAxis.HORIZONTAL: {
        if (getDirectionAxis(parentDir) === Axis.HORIZONTAL) {
          canonicalPref = PreferredAxis.PARENT;
        } else {
          canonicalPref = PreferredAxis.PERPENDICULAR;
        }
        break;
      }
      case PreferredAxis.VERTICAL: {
        if (getDirectionAxis(parentDir) === Axis.VERTICAL) {
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
        throw new Error("Node's PreferredAxis must not be null");
    }
    return canonicalPref;
  }

  /**
   * Changes the layout order of this node's children.
   *
   * The node is invalidated if the preferred axis is actually changed.
   *
   * @param {PreferredAxis} given the new {@link PreferredAxis} to use
   * @throws if root is given and {@link PreferredAxis} is not <code>VERTICAL</code> or <code>HORIZONTAL</code>
   */
  setLayoutPreference(given: PreferredAxis): void {
    if (this.node().neighbors().isRoot()) {
      if (
        given !== PreferredAxis.VERTICAL &&
        given !== PreferredAxis.HORIZONTAL
      ) {
        throw new Error(
          "Root layout preference can only be VERTICAL or HORIZONTAL"
        );
      }
      if (this.getLayoutPreference() === given) {
        return;
      }
      if (given === PreferredAxis.VERTICAL) {
        // PREFER_HORIZONTAL_AXIS -> PREFER_VERTICAL_AXIS
        this.horzToVert();
      } else {
        // PREFER_VERTICAL_AXIS -> PREFER_HORIZONTAL_AXIS
        this.vertToHorz();
      }
      this._layoutPreference = given;
      this.node().invalidate();
      return;
    }

    given = this.sanitizeLayoutPreference(given);

    const curCanon = this.canonicalLayoutPreference();
    this._layoutPreference = given;
    const newCanon = this.canonicalLayoutPreference();
    if (curCanon === newCanon) {
      return;
    }
    // console.log("Changing", namePreferredAxis(curCanon), "to", namePreferredAxis(newCanon));

    const parentDir = this.node().neighbors().parent()?.direction();
    if (!parentDir) {
      throw new Error("unreachable");
    }

    const paxis = getDirectionAxis(parentDir);
    if (curCanon === PreferredAxis.PARENT) {
      if (paxis === Axis.HORIZONTAL) {
        // parent is horizontal, we're aligned horizontal, and we want vertical
        this.horzToVert();
      } else {
        // parent is vertical, we're aligned vertical, and we want horizontal
        this.vertToHorz();
      }
    } else {
      // curCanon is perpendicular
      if (paxis === Axis.VERTICAL) {
        // parent is vertical, we're aligned horizontal, and we want vertical
        this.horzToVert();
      } else {
        // parent is horizontal, we're aligned vertical, and we want horizontal
        this.vertToHorz();
      }
    }

    this.node().invalidate();
  }

  pull(given: Direction): void {
    if (
      this.node().neighbors().isRoot() ||
      this.node().neighbors().parent()?.reverseDirection() === Direction.OUTWARD
    ) {
      if (isVerticalDirection(given)) {
        this.setLayoutPreference(PreferredAxis.VERTICAL);
      } else {
        this.setLayoutPreference(PreferredAxis.HORIZONTAL);
      }
      return;
    }
    const parentDir = this.node().neighbors().parent()?.direction();
    if (parentDir === undefined) {
      throw new Error("unreachable");
    }
    if (getDirectionAxis(given) === getDirectionAxis(parentDir)) {
      // console.log(namePreferredAxis(PreferredAxis.PARENT));
      this.setLayoutPreference(PreferredAxis.PARENT);
    } else {
      // console.log(namePreferredAxis(PreferredAxis.PERPENDICULAR);
      this.setLayoutPreference(PreferredAxis.PERPENDICULAR);
    }
  }

  layoutOrder(): Direction[] {
    if (this.node().neighbors().isRoot()) {
      if (
        this.getLayoutPreference() === PreferredAxis.HORIZONTAL ||
        this.getLayoutPreference() === PreferredAxis.PERPENDICULAR
      ) {
        return HORIZONTAL_ORDER;
      }
      return VERTICAL_ORDER;
    }
    const parentDir = this.node().neighbors().parent()?.direction();
    if (parentDir === undefined) {
      throw new Error("unreachable");
    }
    if (this.canonicalLayoutPreference() === PreferredAxis.PERPENDICULAR) {
      // console.log("PREFER PERP");
      if (getDirectionAxis(parentDir) === Axis.HORIZONTAL) {
        return VERTICAL_ORDER;
      }
      return HORIZONTAL_ORDER;
    }
    // console.log("PREFER PARALLEL TO PARENT: " +
    //   namePreferredAxis(this.getLayoutPreference()));
    // Parallel preference.
    if (getDirectionAxis(parentDir) === Axis.HORIZONTAL) {
      return HORIZONTAL_ORDER;
    }
    return VERTICAL_ORDER;
  }
}
