import { elapsed } from "parsegraph-timing";
import Direction from "./Direction";

export interface SiblingNode {
  id(): string | number;
  siblings(): DirectionNodeSiblings;
  forEachNode(cb: (n: SiblingNode) => void): void;
  nodeAt(inDirection: Direction): SiblingNode;
  layoutOrder(): Direction[];
  parentNode(): SiblingNode;
  parentDirection(): Direction;
  findPaintGroup(): SiblingNode;
  localPaintGroup(): any;
  paintGroup(): any;
  hasNode(inDirection: Direction): boolean;
  setPaintGroupRoot(n: SiblingNode): void;
  hasAncestor(n: SiblingNode): boolean;
  isRoot(): boolean;
}

export default class DirectionNodeSiblings {
  _prev: SiblingNode;
  _next: SiblingNode;
  _node: SiblingNode;

  constructor(node: SiblingNode) {
    this._node = node;
    this._prev = this._node;
    this._next = this._node;
  }

  node() {
    return this._node;
  }

  verify() {
    const e = new Date();
    for (let n = this.next(); n !== this.node(); n = n.siblings().next()) {
      if (elapsed(e) > 5000) {
        throw new Error();
      }
    }
  }

  removeFromLayout(inDirection: Direction): void {
    const disconnected: SiblingNode = this.node().nodeAt(inDirection);
    if (!disconnected) {
      return;
    }
    const layoutBefore: SiblingNode = this.node()
      .siblings()
      .earlier(inDirection);
    const earliestDisc: SiblingNode = disconnected
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

  private connect(a: SiblingNode, b: SiblingNode): void {
    // console.log("connecting " +  a.id() + " to " + b.id());
    a.siblings()._next = b;
    b.siblings()._prev = a;
  }

  insertIntoLayout(inDirection: Direction): void {
    const node: SiblingNode = this.node().nodeAt(inDirection);
    if (!node) {
      return;
    }

    const nodeHead: SiblingNode = node.siblings().head();

    const layoutAfter: SiblingNode = this.node().siblings().later(inDirection);
    const layoutBefore: SiblingNode = this.node()
      .siblings()
      .earlier(inDirection);

    const nodeTail: SiblingNode = node;
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

  next(): SiblingNode {
    return this._next;
  }

  prev(): SiblingNode {
    return this._prev;
  }

  head(excludeThisNode?: SiblingNode): SiblingNode {
    let deeplyLinked: SiblingNode = this.node();
    let foundOne;
    while (true) {
      foundOne = false;
      const dirs = deeplyLinked.layoutOrder();
      for (let i = 0; i < dirs.length; ++i) {
        const dir = dirs[i];
        const candidate = deeplyLinked.nodeAt(dir);
        if (
          candidate &&
          candidate != excludeThisNode &&
          deeplyLinked.parentDirection() !== dir &&
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

  earlier(inDirection: Direction): SiblingNode {
    let layoutBefore;
    const dirs = this.node().layoutOrder();
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
      if (dir === this.node().parentDirection()) {
        continue;
      }
      if (this.node().hasNode(dir)) {
        const candidate = this.node().nodeAt(dir);
        if (candidate && !candidate.localPaintGroup()) {
          layoutBefore = candidate;
          break;
        }
      }
    }
    return layoutBefore;
  }

  later(inDirection: Direction): SiblingNode {
    let layoutAfter;
    const dirs = this.node().layoutOrder();
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
      if (dir === this.node().parentDirection()) {
        continue;
      }
      if (this.node().hasNode(dir)) {
        const candidate = this.node().nodeAt(dir);
        if (candidate && !candidate.localPaintGroup()) {
          layoutAfter = candidate;
          break;
        }
      }
    }
    return layoutAfter;
  }

  horzToVert() {
    const parentDir = this.node().parentDirection();
    const b =
      parentDir === Direction.BACKWARD
        ? null
        : this.node().nodeAt(Direction.BACKWARD);
    const f =
      parentDir === Direction.FORWARD
        ? null
        : this.node().nodeAt(Direction.FORWARD);
    const u =
      parentDir === Direction.UPWARD
        ? null
        : this.node().nodeAt(Direction.UPWARD);
    const d =
      parentDir === Direction.DOWNWARD
        ? null
        : this.node().nodeAt(Direction.DOWNWARD);
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
    const lastVertNext = lastVert.siblings().next();
    this.connect(firstHorzPrev, firstVert);
    this.connect(lastHorz, lastVertNext);
    this.connect(lastVert, firstHorz);
    this.verify();
  }

  vertToHorz() {
    const parentDir = this.node().parentDirection();
    const b =
      parentDir === Direction.BACKWARD
        ? null
        : this.node().nodeAt(Direction.BACKWARD);
    const f =
      parentDir === Direction.FORWARD
        ? null
        : this.node().nodeAt(Direction.FORWARD);
    const u =
      parentDir === Direction.UPWARD
        ? null
        : this.node().nodeAt(Direction.UPWARD);
    const d =
      parentDir === Direction.DOWNWARD
        ? null
        : this.node().nodeAt(Direction.DOWNWARD);

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

  dump(): SiblingNode[] {
    const nodes: SiblingNode[] = [];
    let node: SiblingNode = this.node();
    do {
      node = node.siblings().next();
      nodes.push(node);
    } while (node !== this.node());
    return nodes;
  }
}
