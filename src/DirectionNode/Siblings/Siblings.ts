import {
  Direction,
  isVerticalDirection,
  getDirectionAxis,
  Axis,
} from "../../Direction";
import { PreferredAxis } from "./PreferredAxis";
import createException, {
  NODE_IS_ROOT,
  BAD_LAYOUT_PREFERENCE,
} from "../../Exception";
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

export class Siblings {
  _prev: DirectionNode;
  _next: DirectionNode;
  _node: DirectionNode;
  _layoutPreference: PreferredAxis;

  constructor(node: DirectionNode) {
    this._node = node;
    this._prev = this._node;
    this._next = this._node;
    this._layoutPreference = PreferredAxis.HORIZONTAL;
  }

  forEachNode(func: (node: DirectionNode) => void): void {
    let node: DirectionNode = this.node();
    do {
      func(node);
      node = node.siblings().prev();
    } while (node !== this.node());
  }

  node() {
    return this._node;
  }

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
    // console.log(this + ".connectNode(" + nameDirection(inDirection) +
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
          !candidate.localPaintGroup()
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
      if (dir === this.node().neighbors().parent()?.reverseDirection()) {
        continue;
      }
      if (this.node().neighbors().hasNode(dir)) {
        const candidate = this.node().neighbors().nodeAt(dir);
        if (candidate && !candidate.localPaintGroup()) {
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
      if (dir === this.node().neighbors().parent()?.reverseDirection()) {
        continue;
      }
      if (this.node().neighbors().hasNode(dir)) {
        const candidate = this.node().neighbors().nodeAt(dir);
        if (candidate && !candidate.localPaintGroup()) {
          layoutAfter = candidate;
          break;
        }
      }
    }
    return layoutAfter;
  }

  horzToVert() {
    const parentDir = this.node().neighbors().parent()?.reverseDirection();
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
    const parentDir = this.node().neighbors().parent()?.reverseDirection();
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
    // Root nodes do not have a canonical layout preference.
    if (this.node().neighbors().isRoot()) {
      throw createException(NODE_IS_ROOT);
    }

    const parentDir = this.node().neighbors().parent()?.direction();
    if (parentDir === undefined) {
      throw new Error("Cannot canonicalize root layout preference");
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
        throw createException(BAD_LAYOUT_PREFERENCE);
    }
    return canonicalPref;
  }

  setLayoutPreference(given: PreferredAxis): void {
    if (this.node().neighbors().isRoot()) {
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
        this.horzToVert();
      } else {
        // PREFER_VERTICAL_AXIS -> PREFER_HORIZONTAL_AXIS
        this.vertToHorz();
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

    const parentDir = this.node().neighbors().parent()?.direction();
    if (!parentDir) {
      throw new Error("unreachable");
    }

    const paxis = getDirectionAxis(parentDir);
    if (curCanon === PreferredAxis.PARENT) {
      if (paxis === Axis.HORIZONTAL) {
        this.horzToVert();
      } else {
        this.vertToHorz();
      }
    } else {
      if (paxis === Axis.VERTICAL) {
        this.vertToHorz();
      } else {
        this.horzToVert();
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
