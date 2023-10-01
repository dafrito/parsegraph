import { findPaintGroup } from "./findPaintGroup";
import { SiblingNode } from "./DirectionNodeSiblings";
import { findPaintGroupInsert } from "./findPaintGroupInsert";
import { getLastPaintGroup } from "./getLastPaintGroup";
import makeLimit from "./makeLimit";

export interface PaintGroupNode<T extends PaintGroupNode<T>>
  extends SiblingNode<T> {
  paintGroup(): DirectionNodePaintGroup<T>;
  clearPaintGroup(): void;
  setPaintGroupRoot(root: T): void;
  localPaintGroup(): DirectionNodePaintGroup<T> | undefined;
}

export class DirectionNodePaintGroup<T extends PaintGroupNode<T>> {
  _next: T;
  _prev: T;
  _node: T;
  _explicit: boolean;

  constructor(node: T, explicit: boolean) {
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
      const [prevNode, nextNode] = findPaintGroupInsert(parentsPaintGroup.node(), this.node());
      this.connect(prevNode, this.node());
      this.connect(this.node(), nextNode);
    }
    this.node().layoutChanged();
    this.node()
      .siblings()
      .forEachNode((n) => n.setPaintGroupRoot(this.node()));
    this.verify();
  }

  clearExplicit() {
    this._explicit = false;
  }

  firstAndLast(): [T | null, T | null] {
    const pg = findPaintGroup(this.node());
    if (!pg.localPaintGroup()) {
      return [null, null];
    }
    let lastPaintGroup: T | null = null;
    let firstPaintGroup: T | null = null;
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
      firstPaintGroup?.localPaintGroup() ? firstPaintGroup : null,
      lastPaintGroup.localPaintGroup() ? lastPaintGroup : null,
    ];
  }

  node() {
    return this._node;
  }

  private connect(a: SiblingNode<any>, b: SiblingNode<any>): void {
    (a === this.node() ? this : a.localPaintGroup())._next = b;
    (b === this.node() ? this : b.localPaintGroup())._prev = a;
  }

  next(): T {
    return this._next;
  }

  prev(): T {
    return this._prev;
  }

  explicit() {
    return this._explicit;
  }

  append(node: T) {
    const [prevNode, nextNode] = findPaintGroupInsert(this.node(), node);
    const nodeLast = getLastPaintGroup(node);
    // console.log("Append", node.id(), "to", nodeLast.id(), "between", prevNode.id(), "and", nextNode.id());
    this.connect(prevNode, node);
    this.connect(nodeLast, nextNode);
    this.verify();
  }

  merge(node: T) {
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
    pg.siblings().forEachNode((n) => n.setPaintGroupRoot(pg));
    this.node().clearPaintGroup();
    this.node().layoutChanged();
    this.verify();
  }

  last(): T {
    let candidate = this.node().siblings().prev();
    while (candidate !== this.node()) {
      if (candidate.localPaintGroup()) {
        break;
      }
      candidate = candidate.siblings().prev();
    }
    return candidate;
  }

  dump(): T[] {
    const pgs: T[] = [];
    let pg: T = this.node();
    const lim = makeLimit();
    do {
      pgs.push(pg);
      pg = pg.paintGroup().next();
      lim();
    } while (pg !== this.node());
    return pgs;
  }
}
