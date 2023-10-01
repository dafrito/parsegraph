import { findPaintGroup } from "./findPaintGroup";
import { findPaintGroupInsert } from "./findPaintGroupInsert";
import { getLastPaintGroup } from "./getLastPaintGroup";
import makeLimit from "./makeLimit";
import { DirectionNode } from "..";
import createException, { NOT_PAINT_GROUP } from "../Exception";

export class PaintGroup {
  _next: DirectionNode;
  _prev: DirectionNode;
  _node: DirectionNode;
  _explicit: boolean;

  constructor(node: DirectionNode, explicit: boolean) {
    this._node = node;
    this._next = this._node;
    this._prev = this._node;
    this._explicit = explicit;

    if (this.node().neighbors().isRoot()) {
      const [firstPaintGroup, lastPaintGroup] = this.firstAndLast();
      if (firstPaintGroup && lastPaintGroup) {
        this.connect(
          firstPaintGroup.paintGroup().prev(),
          lastPaintGroup.paintGroup().next()
        );
        this.connect(this.node(), firstPaintGroup);
        this.connect(lastPaintGroup, this.node());
      }
    } else {
      // Remove the node from its parent's layout.
      const par = this.node().neighbors().parent();
      if (!par) {
        throw new Error("Node must have a parent if it is not root");
      }
      par.node().siblings().removeFromLayout(par.direction());

      // Connect this node's first and last paint groups to this node.
      const parentsPaintGroup = par.node().paintGroup();
      const [prevNode, nextNode] = findPaintGroupInsert(
        parentsPaintGroup.node(),
        this.node()
      );
      this.connect(prevNode, this.node());
      this.connect(this.node(), nextNode);
    }
    this.node().invalidate();
    this.node()
      .siblings()
      .forEachNode((n) => n.setpaintGroupNode(this.node()));
    this.verify();
  }

  clearExplicit() {
    this._explicit = false;
  }

  firstAndLast(): [DirectionNode | null, DirectionNode | null] {
    const pg = findPaintGroup(this.node());
    if (!pg.isPaintGroup()) {
      return [null, null];
    }
    let lastPaintGroup: DirectionNode | null = null;
    let firstPaintGroup: DirectionNode | null = null;
    for (let n = pg.paintGroup().next(); n != pg; n = n.paintGroup().next()) {
      // console.log("First and last iteration. n=" + n.id());
      if (!n.neighbors().hasAncestor(pg)) {
        break;
      }
      if (!n.neighbors().hasAncestor(this.node())) {
        continue;
      }
      if (!lastPaintGroup) {
        firstPaintGroup = n;
        lastPaintGroup = n;
      } else {
        firstPaintGroup = n;
      }
    }
    if (!lastPaintGroup) {
      firstPaintGroup = this.node();
      lastPaintGroup = this.node();
    }
    return [
      firstPaintGroup?.isPaintGroup() ? firstPaintGroup : null,
      lastPaintGroup.isPaintGroup() ? lastPaintGroup : null,
    ];
  }

  node() {
    return this._node;
  }

  private connect(a: DirectionNode, b: DirectionNode): void {
    const aPG = a === this.node() ? this : a.paintGroup();
    if (!aPG) {
      throw new Error("a paint group is missing");
    }
    aPG._next = b;
    const bPG = b === this.node() ? this : b.paintGroup();
    if (!bPG) {
      throw new Error("b paint group is missing");
    }
    bPG._prev = a;
  }

  next(): DirectionNode {
    return this._next;
  }

  prev(): DirectionNode {
    return this._prev;
  }

  explicit() {
    return this._explicit;
  }

  append(node: DirectionNode) {
    const [prevNode, nextNode] = findPaintGroupInsert(this.node(), node);
    const nodeLast = getLastPaintGroup(node);
    // console.log("Append", node.id(), "to", nodeLast.id(), "between", prevNode.id(), "and", nextNode.id());
    this.connect(prevNode, node);
    this.connect(nodeLast, nextNode);
    this.verify();
  }

  merge(node: DirectionNode) {
    const [prevNode, nextNode] = findPaintGroupInsert(this.node(), node);
    const paintGroupLast = prevNode;
    const nodeFirst = node.paintGroup().next();
    const nodeLast = node.paintGroup().prev();
    // console.log("Merge", node.id(), "between", paintGroupLast.id(), "and", nextNode.id());
    this.connect(paintGroupLast, nodeFirst);
    this.connect(nodeLast, nextNode);
    this.verify();
  }

  disconnect() {
    const paintGroupLast = getLastPaintGroup(this.node());

    this.connect(
      this.node().paintGroup().prev(),
      paintGroupLast.paintGroup().next()
    );
    this.connect(paintGroupLast, this.node());
    this.verify();
  }

  verify() {
    const lim = makeLimit();
    for (let n = this.next(); n !== this.node(); n = n.paintGroup().next()) {
      // console.log(n.id());
      lim();
    }
    for (let n = this.prev(); n !== this.node(); n = n.paintGroup().prev()) {
      // console.log(n.id());
      lim();
    }
  }

  crease() {
    this._explicit = true;
  }

  uncrease() {
    this._explicit = false;

    // console.log(this + " is no longer a paint group.");
    if (this.node().neighbors().isRoot()) {
      // Retain the paint groups for this implied paint group.
      return;
    }
    const par = this.node().neighbors().parent();
    if (!par) {
      throw new Error("Node is root but has no parent");
    }
    const paintGroupLast = this.node().paintGroup().last();
    par.node().siblings().insertIntoLayout(par.direction());

    // Remove the paint group's entry in the parent.
    // console.log("Node " + this +
    //   " is not a root, so adding paint groups.");
    if (paintGroupLast !== this.node()) {
      this.connect(paintGroupLast, this.next());
    } else {
      this.connect(this.prev(), this.next());
    }
    this._next = this.node();
    this._prev = this.node();

    const pg = findPaintGroup(par.node());
    pg.siblings().forEachNode((n) => n.setpaintGroupNode(pg));
    this.node().clearPaintGroup();
    this.node().invalidate();
    this.verify();
  }

  last(): DirectionNode {
    let candidate = this.node().siblings().prev();
    while (candidate !== this.node()) {
      if (candidate.isPaintGroup()) {
        break;
      }
      candidate = candidate.siblings().prev();
    }
    return candidate;
  }

  forEach(func: (node: DirectionNode) => void): void {
    let node: DirectionNode = this.node();
    let prev = node;
    do {
      if (!node.paintGroup()) {
        throw createException(NOT_PAINT_GROUP);
      }
      func(node);
      node = node.paintGroup().prev();
      if (prev === node && node !== this.node()) {
        throw new Error("loop detected");
      }
      prev = node;
    } while (node !== this.node());
  }

  dump(): DirectionNode[] {
    const pgs: DirectionNode[] = [];
    let pg: DirectionNode = this.node();
    const lim = makeLimit();
    do {
      pgs.push(pg);
      pg = pg.paintGroup().next();
      lim();
    } while (pg !== this.node());
    return pgs;
  }
}
