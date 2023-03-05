import { reverseDirection } from "./Direction";
import { SiblingNode } from "./DirectionNodeSiblings";
import { makeLimit } from "./utils";

export interface PaintGroupNode extends SiblingNode {
  paintGroup(): DirectionNodePaintGroup;
  layoutChanged(): void;
  _paintGroup: DirectionNodePaintGroup;
  getLastPaintGroup(): PaintGroupNode;
  findPaintGroupInsert(
    inserted: PaintGroupNode
  ): [PaintGroupNode, PaintGroupNode];
  findDistance(other: PaintGroupNode): number;
  pathToRoot(): PaintGroupNode[];
  comesBefore(other: PaintGroupNode): boolean;
}

export default class DirectionNodePaintGroup {
  _next: PaintGroupNode;
  _prev: PaintGroupNode;
  _node: PaintGroupNode;
  _explicit: boolean;

  constructor(node: PaintGroupNode, explicit: boolean) {
    this._node = node;
    this._next = this._node;
    this._prev = this._node;
    this._explicit = explicit;

    if (this.node().isRoot()) {
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
      this.node()
        .parentNode()
        .siblings()
        .removeFromLayout(reverseDirection(this.node().parentDirection()));

      // Connect this node's first and last paint groups to this node.
      const parentsPaintGroup = this.node().parentNode().paintGroup();
      const [prevNode, nextNode] = parentsPaintGroup
        .node()
        .findPaintGroupInsert(this.node());
      this.connect(prevNode, this.node());
      this.connect(this.node(), nextNode);
    }
    this.node().layoutChanged();
    this.node().forEachNode((n) => n.setPaintGroupRoot(this.node()));
    this.verify();
  }

  clearExplicit() {
    this._explicit = false;
  }

  firstAndLast(): [SiblingNode, SiblingNode] {
    const pg = this.node().findPaintGroup();
    if (!pg.localPaintGroup()) {
      return [null, null];
    }
    let lastPaintGroup: PaintGroupNode = null;
    let firstPaintGroup: PaintGroupNode = null;
    for (let n = pg.paintGroup().next(); n != pg; n = n.paintGroup().next()) {
      // console.log("First and last iteration. n=" + n.id());
      if (!n.hasAncestor(pg)) {
        break;
      }
      if (!n.hasAncestor(this.node())) {
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
      firstPaintGroup.localPaintGroup() ? firstPaintGroup : null,
      lastPaintGroup.localPaintGroup() ? lastPaintGroup : null,
    ];
  }

  node() {
    return this._node;
  }

  toString() {
    return `(Paint group: prev=${this._prev.id()} this=${this.node().id()} next=${this._next.id()})`;
  }

  private connect(a: SiblingNode, b: SiblingNode): void {
    (a === this.node() ? this : a.localPaintGroup())._next = b;
    (b === this.node() ? this : b.localPaintGroup())._prev = a;
  }

  next(): PaintGroupNode {
    return this._next;
  }

  prev(): PaintGroupNode {
    return this._prev;
  }

  explicit() {
    return this._explicit;
  }

  append(node: PaintGroupNode) {
    const [prevNode, nextNode] = this.node().findPaintGroupInsert(node);
    const nodeLast = node.getLastPaintGroup();
    // console.log("Append", node.id(), "to", nodeLast.id(), "between", prevNode.id(), "and", nextNode.id());
    this.connect(prevNode, node);
    this.connect(nodeLast, nextNode);
    this.verify();
  }

  merge(node: PaintGroupNode) {
    const [prevNode, nextNode] = this.node().findPaintGroupInsert(node);
    const paintGroupLast = prevNode;
    const nodeFirst = node.paintGroup().next();
    const nodeLast = node.paintGroup().prev();
    // console.log("Merge", node.id(), "between", paintGroupLast.id(), "and", nextNode.id());
    this.connect(paintGroupLast, nodeFirst);
    this.connect(nodeLast, nextNode);
    this.verify();
  }

  disconnect() {
    const paintGroupLast = this.node().getLastPaintGroup();

    // console.log("Disconnecting paintgroups ", this.node().id(), "to", paintGroupLast.id(), "from layout");

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
    if (this.node().isRoot()) {
      // Retain the paint groups for this implied paint group.
      return;
    }
    const paintGroupLast = this.node().paintGroup().last();
    this.node()
      .parentNode()
      .siblings()
      .insertIntoLayout(reverseDirection(this.node().parentDirection()));

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

    const pg = this.node().parentNode().findPaintGroup();
    pg.forEachNode((n) => n.setPaintGroupRoot(pg));
    this.node()._paintGroup = null;
    this.node().layoutChanged();
    this.verify();
  }

  last(): SiblingNode {
    let candidate = this.node().siblings().prev();
    while (candidate !== this.node()) {
      if (candidate.localPaintGroup()) {
        break;
      }
      candidate = candidate.siblings().prev();
    }
    return candidate;
  }

  dump(): PaintGroupNode[] {
    const pgs: PaintGroupNode[] = [];
    let pg: PaintGroupNode = this.node();
    const lim = makeLimit();
    do {
      pgs.push(pg);
      pg = pg.paintGroup().next();
      lim();
    } while (pg !== this.node());
    return pgs;
  }
}
