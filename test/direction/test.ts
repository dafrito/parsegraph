import { expect, assert } from "chai";
import { Direction, readDirection } from "../../src/Direction";

import {
  findPaintGroupInsert,
} from "../../src/DirectionNode/findPaintGroupInsert"
import {
  DirectionNode,
  comesBefore,
  PreferredAxis,
  namePreferredAxis,
  findPaintGroup,
} from "../../src/DirectionNode";

import { DirectionCaret } from "../../src/DirectionCaret";

function makeCaret() {
  return new DirectionCaret();
}

describe("Package", function () {
  it("works", () => {
    expect(readDirection("f")).to.equal(Direction.FORWARD);
  });
});

describe("DirectionNode", function () {
  it("works", () => {
    const node = new DirectionNode();
    expect(node).to.be.instanceof(DirectionNode);
    assert(node.neighbors().isRoot());
  });

  it("can be made directly", () => {
    const node = new DirectionNode();
    expect(node).to.be.instanceof(DirectionNode);
    assert(node.neighbors().isRoot());
  });

  it("can have its value set", () => {
    const node = new DirectionNode();
    node.setValue("No time");
    assert.equal(node.value(), "No time");
    node.setValue(42);
    assert.equal(node.value(), 42);
  });

  it("PaintGroup sanity", function () {
    // Spawn the graph.
    const caret = makeCaret();

    const node = caret.node();
    assert.equal(
      node.paintGroup().next(),
      node,
      "Node's paint group next must be itself"
    );
    const creased = caret.spawnMove(Direction.FORWARD);
    assert.equal(
      creased.paintGroup().next(),
      creased.paintGroup().next(),
      "Child's paint group next is not null"
    );
  });

  it("PaintGroup creased sanity", function () {
    // Spawn the graph.
    const caret = makeCaret();

    const node = caret.node();
    assert.equal(
      node.paintGroup().next(),
      node,
      "Node's paint group next is not itself"
    );
    const creased = caret.spawnMove(Direction.FORWARD);
    assert.notEqual(
      creased.paintGroup().next(),
      null,
      "Child's paint group next is not null"
    );
    caret.crease();
    assert.notEqual(
      creased.paintGroup().next(),
      creased,
      "Child's paint group next is not itself"
    );
    assert.equal(
      creased.paintGroup().next(),
      node,
      "Child's paint group next is node "
    );
  });

  it("Viewport - Block with forward creased bud", function () {
    // Spawn the graph.
    const caret = makeCaret();
    const creased = caret.spawnMove(Direction.FORWARD);
    caret.crease();
    const grandchild = caret.spawnMove(Direction.FORWARD);
    caret.moveToRoot();
    assert.notEqual(
      creased.siblings().next(),
      creased,
      "Creased's next sibling must not be itself"
    );
    assert.notEqual(
      creased.siblings().next(),
      caret.root(),
      "Creased's next sibling must not be root"
    );
    assert.equal(
      creased.siblings().next(),
      grandchild,
      "Creased layout next must be " +
        grandchild +
        " but was " +
        creased.siblings().next()
    );
    assert.equal(
      grandchild.siblings().next(),
      creased,
      "Grandchilds layout next must be " +
        creased +
        " but was " +
        grandchild.siblings().next()
    );
    assert.equal(
      creased.paintGroup().next(),
      caret.root(),
      creased +
        "'s next paint group must be the root but was " +
        creased.paintGroup().next()
    );
    assert.equal(
      caret.root().paintGroup().next(),
      creased,
      caret.root() +
        "'s next paint group must be " +
        creased +
        " but was " +
        caret.root().paintGroup().next()
    );
  });

  it("Viewport - Block with forward creased bud, uncreased", function () {
    // Spawn the graph.
    const caret = makeCaret();
    const root = caret.root();

    const creased = caret.spawnMove(Direction.FORWARD);
    caret.crease();
    caret.spawnMove(Direction.FORWARD);
    creased.uncrease();

    expect(creased.localPaintGroup()).to.equal(undefined);
    expect(creased.localPaintGroup()).to.equal(undefined);
    expect(root.localPaintGroup()).to.not.equal(undefined);
    expect(root.localPaintGroup()?.next()).to.equal(root);
    expect(root.localPaintGroup()?.prev()).to.equal(root);
  });

  it("Viewport - Block with forward bud, removed", function () {
    // Spawn the graph.
    const caret = makeCaret();
    const root = caret.root();
    const child = caret.spawnMove(Direction.FORWARD);
    caret.spawnMove(Direction.FORWARD);
    expect(child.localPaintGroup()).to.equal(undefined);
    expect(root.localPaintGroup()?.next()).to.not.equal(child);
    expect(root.localPaintGroup()?.next()).to.equal(root);

    child.disconnectNode();
    expect(child.localPaintGroup()).to.not.equal(undefined);
    expect(child.localPaintGroup()).to.equal(child.paintGroup());

    expect(root.localPaintGroup()).to.not.equal(undefined);
    expect(
      root.localPaintGroup()?.next(),
      "Root's paint group should not be child"
    ).to.not.equal(child);

    expect(root.localPaintGroup()?.next()).to.equal(root);
    expect(root.localPaintGroup()?.prev()).to.not.equal(child);
    expect(root.localPaintGroup()?.prev()).to.equal(root);
  });

  it("Node Morris world threading spawned", function () {
    const n = new DirectionNode();
    n.connectNode(Direction.FORWARD, new DirectionNode());
  });
});

describe("DirectionCaret", function () {
  it("works", () => {
    const caret = makeCaret();
    if (
      caret.has(Direction.FORWARD) ||
      caret.has(Direction.BACKWARD) ||
      caret.has(Direction.UPWARD) ||
      caret.has(Direction.DOWNWARD)
    ) {
      throw new Error("Graph roots must begin as leaves.");
    }

    caret.spawn(Direction.FORWARD);
    if (!caret.has(Direction.FORWARD)) {
      throw new Error("Graph must add nodes in the specified direction.");
    }
    if (
      caret.has(Direction.DOWNWARD) ||
      caret.has(Direction.BACKWARD) ||
      caret.has(Direction.UPWARD)
    ) {
      throw new Error("Graph must not add nodes in incorrect directions.");
    }

    caret.erase(Direction.FORWARD);
    if (
      caret.has(Direction.FORWARD) ||
      caret.has(Direction.BACKWARD) ||
      caret.has(Direction.UPWARD) ||
      caret.has(Direction.DOWNWARD)
    ) {
      throw new Error("Erase must remove the specified node.");
    }
  });

  it("nodeAt returns parent", function () {
    // Build the graph.
    const caret = makeCaret();
    caret.spawn(Direction.DOWNWARD);
    caret.move("d");
    if (caret.node().neighbors().nodeAt(Direction.UPWARD) === null) {
      throw new Error("nodeAt must return parent if possible");
    }
    caret.move("u");
    caret.moveToRoot();
  });

  it("Multiple crease still creates valid paint group chain", function () {
    // console.log("Multiple crease");
    const caret = makeCaret();
    caret.node().setId("Multiple crease root");
    const first = caret.spawnMove(Direction.DOWNWARD);
    first.setId("first");
    const second = caret.spawnMove(Direction.DOWNWARD);
    second.setId("second");
    const third = caret.spawnMove(Direction.DOWNWARD);
    third.setId("third");
    const fourth = caret.spawnMove(Direction.DOWNWARD);
    fourth.setId("fourth");
    const fifth = caret.spawnMove(Direction.DOWNWARD);
    fifth.setId("fifth");
    first.crease();
    assert.equal(caret.root().paintGroup().dump()[1].id(), first.id());
    third.crease();
    const pgs = caret.root().paintGroup().dump();
    if (pgs[1] !== first) {
      // console.log(pgs);
      throw new Error(
        "Second paint group must be " + first.id() + " but was " + pgs[1].id()
      );
    }
    if (pgs[2] !== third) {
      // console.log(pgs);
      throw new Error(
        "Third paint group must be " + third + " but was " + pgs[2]
      );
    }
    if (pgs[0] !== caret.root()) {
      // console.log(pgs);
      throw new Error(
        "First paint group must be " + caret.root() + " but was " + pgs[0]
      );
    }
    // console.log("Multiple crease DONE");
  });

  it("Fancy crease", function () {
    // Build the graph.
    const caret = makeCaret();
    caret.node().setId("root");
    const first = caret.spawnMove(Direction.DOWNWARD);
    first.setId("first");
    const second = caret.spawnMove(Direction.DOWNWARD);
    caret.push();
    second.setId("second");
    const third = caret.spawnMove(Direction.DOWNWARD);
    third.setId("third");
    const fourth = caret.spawnMove(Direction.DOWNWARD);
    fourth.setId("fourth");
    caret.pop();
    let n = caret.node();
    while (n) {
      n.crease();
      n = n.neighbors().nodeAt(Direction.DOWNWARD);
    }
    second.uncrease();
    caret.moveToRoot();
    // console.log(paintGroup().dump(caret.root()));
  });

  it("Creased forward buds", function () {
    // console.log("Creased forward buds");
    const car = makeCaret();
    const root = car.root();
    root.setId("root");
    const bnode = car.spawnMove("f", "u");
    bnode.setId("bnode");
    car.crease();
    // console.log("root next: " + root.paintGroup().next().id());
    // console.log("bnode next: " + bnode.paintGroup().next().id());
    const cnode = car.spawnMove("f", "u");
    cnode.setId("cnode");
    car.crease();
    if (root.siblings().next() !== root) {
      // console.log("root next: " + root.paintGroup().next().id());
      // console.log("bnode next: " + bnode.paintGroup().next().id());
      // console.log("cnode next: " + cnode.paintGroup().next().id());
      throw new Error(
        "root's next layout node must be itself but was " +
          root.siblings().next()
      );
    }
    if (root.paintGroup().next() !== bnode) {
      // console.log(root);
      // console.log(bnode);
      // console.log(cnode);
      throw new Error(
        "root's next paint group must be bnode but was " +
          root.paintGroup().next().id()
      );
    }
  });

  it("Node layout preference test", function () {
    const root = new DirectionNode();
    root.setId("root");

    const a = new DirectionNode();
    a.setId("a");
    const b = new DirectionNode();
    b.setId("b");
    const c = new DirectionNode();
    c.setId("c");

    const chi = new DirectionNode();
    chi.setId("chi");

    chi.connectNode(Direction.FORWARD, c);

    // root--a--b
    //       |
    //      chi--c

    // console.log("cur a",
    //   namePreferredAxis(a._layoutPreference));
    a.connectNode(Direction.DOWNWARD, chi);
    a.connectNode(Direction.FORWARD, b);
    root.connectNode(Direction.FORWARD, a);
    a.siblings().setLayoutPreference(PreferredAxis.PERPENDICULAR);

    // console.log("new a",
    //   namePreferredAxis(a._layoutPreference));
    const r = getLayoutNodes(root)[0];
    if (r !== c) {
      throw new Error("Expected c, got " + r.id());
    }

    root.disconnectNode(Direction.FORWARD);
    if (a.siblings().getLayoutPreference() !== PreferredAxis.VERTICAL) {
      throw new Error(
        "a layoutPreference was not VERT but " +
          namePreferredAxis(a.siblings().getLayoutPreference())
      );
    }
  });

  it("Node Morris world threading connected", () => {
    const n = new DirectionNode();
    if (n.siblings().next() != n) {
      throw new Error("Previous sanity");
    }
    if (n.siblings().prev() != n) {
      throw new Error("Next sanity");
    }

    const b = new DirectionNode();
    if (b.siblings().next() != b) {
      throw new Error("Previous sanity");
    }
    if (b.siblings().prev() != b) {
      throw new Error("Next sanity");
    }

    n.connectNode(Direction.FORWARD, b);
    if (n.siblings().prev() != b) {
      throw new Error("Next connected sanity");
    }
    if (b.siblings().prev() != n) {
      throw new Error();
    }
    if (n.siblings().next() != b) {
      throw new Error();
    }
    if (b.siblings().next() != n) {
      throw new Error();
    }
  });

  it("Node Morris world threading connected with multiple siblings", function () {
    const n = new DirectionNode();
    n.setId("n");
    if (n.siblings().next() != n) {
      throw new Error("Previous sanity");
    }
    if (n.siblings().prev() != n) {
      throw new Error("Next sanity");
    }

    const b = new DirectionNode();
    b.setId("b");
    if (b.siblings().next() != b) {
      throw new Error("Previous sanity");
    }
    if (b.siblings().prev() != b) {
      throw new Error("Next sanity");
    }

    n.connectNode(Direction.FORWARD, b);
    if (n.siblings().prev() != b) {
      throw new Error("Next connected sanity");
    }
    if (b.siblings().prev() != n) {
      throw new Error("Next connected sanity");
    }
    if (n.siblings().next() != b) {
      throw new Error("Next connected sanity");
    }
    if (b.siblings().next() != n) {
      throw new Error("Next connected sanity");
    }
    const c = new DirectionNode();
    c.setId("c");
    n.connectNode(Direction.BACKWARD, c);

    const nodes = getLayoutNodes(n);
    if (nodes[0] != c) {
      throw new Error("First node is not C");
    }
    if (nodes[1] != b) {
      throw new Error("Second node is not B");
    }
    if (nodes[2] != n) {
      throw new Error("Third node is not n");
    }
  });

  it(
    "Node Morris world threading connected with" +
      " multiple siblings and disconnected",
    () => {
      const n = new DirectionNode();
      n.setId("n");
      const b = new DirectionNode();
      b.setId("b");

      const inner = b.connectNode(Direction.INWARD, new DirectionNode());
      inner.setId("inner");
      if (b.siblings().prev() != inner) {
        throw new Error("B layoutBefore isn't inner");
      }
      if (inner.siblings().prev() != b) {
        throw new Error("Inner layoutBefore isn't B");
      }

      n.connectNode(Direction.FORWARD, b);
      if (n.siblings().prev() != b) {
        throw new Error("Next connected sanity");
      }
      if (b.siblings().prev() != inner) {
        throw new Error("N layoutBefore wasn't B");
      }
      if (inner.siblings().prev() != n) {
        throw new Error("N layoutBefore wasn't B");
      }
      if (n.siblings().next() != inner) {
        throw new Error("N layoutBefore wasn't B");
      }
      if (inner.siblings().next() != b) {
        throw new Error("N layoutBefore wasn't B");
      }
      if (b.siblings().next() != n) {
        throw new Error("N layoutBefore wasn't B");
      }
      // console.log("LNS");
      // console.log(getLayoutNodes(n));
      const c = new DirectionNode();
      c.setId("c");
      n.connectNode(Direction.BACKWARD, c);
      // console.log("PLNS");
      // console.log(getLayoutNodes(n));

      const nodes = getLayoutNodes(n);
      if (nodes[0] != c) {
        throw new Error("First node is not C");
      }
      if (nodes[1] != inner) {
        throw new Error("Second node is not inner");
      }
      if (nodes[2] != b) {
        throw new Error("Third node is not b");
      }
      if (nodes[3] != n) {
        throw new Error("Third node is not n");
      }
      if (b !== n.disconnectNode(Direction.FORWARD)) {
        throw new Error("Not even working properly");
      }
    }
  );

  it(
    "Node Morris world threading connected with" +
      " multiple siblings and disconnected 2",
    function () {
      const n = new DirectionNode();
      n.setId("n");
      if (n.siblings().next() != n) {
        throw new Error("Previous sanity");
      }
      if (n.siblings().prev() != n) {
        throw new Error("Next sanity");
      }

      const b = new DirectionNode();
      b.setId("b");
      testLayoutNodes([b]);

      const inner = b.connectNode(Direction.INWARD, new DirectionNode());
      inner.setId("inner");
      testLayoutNodes([inner, b]);

      n.connectNode(Direction.FORWARD, b);
      testLayoutNodes([inner, b, n]);
      const c = new DirectionNode();
      c.setId("c");
      n.connectNode(Direction.BACKWARD, c);
      testLayoutNodes([c, inner, b, n]);
      if (c !== n.disconnectNode(Direction.BACKWARD)) {
        throw new Error("Not even working properly");
      }
      testLayoutNodes([c], "disconnected");
      testLayoutNodes([inner, b, n], "finished");
    }
  );

  it("Node Morris world threading deeply connected", function () {
    const n = new DirectionNode();
    n.setId("n");
    testLayoutNodes([n], "deeply conn 1");
    const b = n.connectNode(Direction.FORWARD, new DirectionNode());
    b.setId("b");
    testLayoutNodes([b, n], "deeply conn 2");
    const c = b.connectNode(Direction.DOWNWARD, new DirectionNode());
    c.setId("c");
    testLayoutNodes([c, b, n], "deeply conn 3");
    const d = b.connectNode(Direction.FORWARD, new DirectionNode());
    d.setId("d");
    b.siblings().setLayoutPreference(PreferredAxis.VERTICAL);
    testLayoutNodes([c, d, b, n], "deeply conn 4");

    if (n.siblings().next() !== c) {
      throw new Error(
        "Previous sanity 1: got " +
          n.siblings().next().id() +
          " expected " +
          c.id()
      );
    }
    if (d.siblings().next() !== b) {
      throw new Error("Previous sanity 2");
    }
    if (c.siblings().next() !== d) {
      throw new Error("Previous sanity 3");
    }
    if (b.siblings().next() !== n) {
      throw new Error("Previous sanity 4");
    }
  });

  it("Disconnect simple test", function () {
    // console.log("DISCONNECT SIMPLE TEST");
    const car = makeCaret();
    const originalRoot = car.node();
    const midRoot = car.spawnMove("f", "b");
    car.spawnMove("f", "b");
    // *=[]=[] <--newRoot == car
    // ^oldRoot
    const newRoot = car.node();
    if (originalRoot.siblings().next() != newRoot) {
      console.log("originalRoot", originalRoot);
      console.log("midRoot", midRoot);
      console.log(
        "layoutAfter of originalRoot",
        originalRoot.siblings().next()
      );
      console.log("newRoot", newRoot);
      throw new Error("Original's previous should be newroot");
    }
    // console.log("Doing disconnect");
    car.disconnect();
    if (originalRoot.siblings().next() != midRoot) {
      console.log("originalRoot", originalRoot);
      console.log("midRoot", midRoot);
      console.log(
        "layoutAfter of originalRoot",
        originalRoot.siblings().next()
      );
      console.log("newRoot", newRoot);
      throw new Error("layoutAfter is invalid");
    }
  });

  it("Disconnect simple test, reversed", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    const midRoot = car.spawnMove("f", "b");
    car.spawnMove("f", "b");
    car.node();
    car.disconnect();
    if (originalRoot.siblings().next() != midRoot) {
      throw new Error("layoutAfter is invalid");
    }
  });

  it("Node Morris world threading connected with crease", function () {
    const n = new DirectionNode();
    const b = new DirectionNode();
    n.connectNode(Direction.FORWARD, b);
    b.crease();
    if (b.siblings().next() !== b) {
      throw new Error(
        "Crease must remove that node" +
          " from its parents layout chain (child)"
      );
    }
    if (n.siblings().next() !== n) {
      throw new Error(
        "Crease must remove that node" +
          " from its parents layout chain (parent)"
      );
    }
  });

  it("Node Morris world threading connected with creased child", function () {
    const n = new DirectionNode();
    const b = new DirectionNode();
    b.crease();
    n.connectNode(Direction.FORWARD, b);
    if (b.siblings().next() !== b) {
      throw new Error(
        "Crease must remove that node" +
          " from its parents layout chain (child)"
      );
    }
    if (n.siblings().next() !== n) {
      throw new Error(
        "Crease must remove that node" +
          " from its parents layout chain (parent)"
      );
    }
  });

  it("Disconnect complex test", function () {
    const car = makeCaret();
    car.spawnMove("f", "b");
    car.push();
    // console.log("NODE WITH CHILD", car.node());
    car.spawnMove("d", "u");
    // console.log("MOST DOWNWARD NODE OF CHILD", car.node());
    car.pop();
    car.spawnMove("f", "b");
    // console.log("Doing complex disc", originalRoot);
    // console.log(getLayoutNodes(originalRoot));
    car.disconnect();
    // console.log("COMPLEX DISCONNECT DONE");
    // console.log(getLayoutNodes(originalRoot));
    // newRoot.commitLayoutIteratively();
  });

  it("Disconnect parent test, forward", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    car.spawnMove("f", "b");
    const newNode = makeCaret().node();
    originalRoot.connectNode(Direction.FORWARD, newNode);
    if (originalRoot.neighbors().nodeAt(Direction.FORWARD) !== newNode) {
      throw new Error("Unexpected node");
    }
  });

  it("Disconnect parent test", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    car.spawnMove("i", "b");
    const newNode = makeCaret().node();
    originalRoot.connectNode(Direction.INWARD, newNode);
    if (originalRoot.neighbors().nodeAt(Direction.INWARD) !== newNode) {
      throw new Error("Unexpected node");
    }
  });

  it("Disconnect parent test", function () {
    const n = new DirectionNode().setId("n");
    const b = new DirectionNode().setId("b");
    b.crease();
    n.connectNode(Direction.INWARD, b);

    const a = new DirectionNode().setId("a");
    const r = new DirectionNode().setId("r");
    r.crease();
    a.connectNode(Direction.INWARD, r);
    r.connectNode(Direction.INWARD, b);

    // a > r > b

    if (a.paintGroup().next() !== r) {
      throw new Error(
        "Wanted " + r.id() + " but got " + a.paintGroup().next().id()
      );
    }
    if (b.paintGroup().next() !== a) {
      throw new Error(
        "Wanted " + a.id() + " but got " + b.paintGroup().next().id()
      );
    }
    if (r.paintGroup().next() !== b) {
      throw new Error(
        "Wanted " + b.id() + " but got " + r.paintGroup().next().id()
      );
    }
    if (n.paintGroup().next() !== n) {
      throw new Error(
        "Wanted " + n.id() + " but got " + n.paintGroup().next().id()
      );
    }
  });

  it("Disconnect parent test, removal", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    car.spawnMove("i", "b");
    const newNode = makeCaret().spawnMove("i", "b");
    originalRoot.connectNode(Direction.INWARD, newNode);
    if (originalRoot.neighbors().nodeAt(Direction.INWARD) !== newNode) {
      throw new Error("Unexpected node");
    }
  });

  it("Disconnect parent test, creased removal", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    const midRoot = car.spawnMove("i", "b");
    car.crease();
    let pgs = originalRoot.paintGroup().dump();
    assert.deepEqual(pgs, [originalRoot, midRoot]);
    const newNode = makeCaret().spawnMove("i", "b");
    newNode.crease();
    originalRoot.connectNode(Direction.INWARD, newNode);
    if (originalRoot.neighbors().nodeAt(Direction.INWARD) !== newNode) {
      throw new Error("Unexpected node");
    }
    pgs = originalRoot.paintGroup().dump();
    assert.deepEqual(
      pgs.map((n) => n.id()),
      [originalRoot.id(), newNode.id()]
    );
  });

  it("Painted before, complex creased removal", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    originalRoot.setId("originalRoot");
    const midRoot = car.spawnMove("i", "b");
    midRoot.setId("midRoot");
    assert.isTrue(comesBefore(originalRoot, midRoot));
    car.crease();
    const newNode = makeCaret().spawnMove("i", "b");
    newNode.setId("newNode");
    newNode.crease();
    midRoot.connectNode(Direction.INWARD, newNode);
    // assert.isTrue(newNode.comesBefore(midRoot));
  });

  it("Disconnect parent test, complex creased removal", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    originalRoot.setId("originalRoot");
    const midRoot = car.spawnMove("i", "b");
    midRoot.setId("midRoot");
    car.crease();
    let pgs = originalRoot.paintGroup().dump();
    assert.deepEqual(pgs, [originalRoot, midRoot]);
    const newNode = makeCaret().spawnMove("i", "b");
    newNode.setId("newNode");
    newNode.crease();
    midRoot.connectNode(Direction.INWARD, newNode);
    pgs = originalRoot.paintGroup().dump();
    assert.deepEqual(
      pgs.map((n) => n.id()),
      [originalRoot.id(), midRoot.id(), newNode.id()]
    );
  });

  it("Disconnect parent test 2, complex creased removal", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    originalRoot.setId("originalRoot");
    const midRoot = car.spawnMove("i", "b");
    midRoot.setId("midRoot");
    car.crease();
    let pgs = originalRoot.paintGroup().dump();
    assert.deepEqual(pgs, [originalRoot, midRoot]);
    const newNode = makeCaret().spawnMove("i", "b");
    newNode.setId("newNode");
    newNode.crease();
    newNode.neighbors().root().setId("newNode-root");
    midRoot.connectNode(Direction.INWARD, newNode.neighbors().root());
    pgs = originalRoot.paintGroup().dump();
    assert.deepEqual(
      pgs.map((n) => n.id()),
      [originalRoot.id(), midRoot.id(), newNode.id()]
    );
  });

  it("Disconnect parent test 3, complex creased removal", function () {
    const car = makeCaret();
    const originalRoot = car.node();
    originalRoot.setId("originalRoot");

    const expected = [originalRoot.id()];
    for (let i = 0; i < 10; ++i) {
      car.spawnMove("d", "u");
      car.pull("f");
      const newNode = makeCaret().spawnMove("i", "b");
      newNode.setId("newNode-" + i);
      newNode.crease();
      newNode
        .neighbors()
        .root()
        .setId("newNode-root-" + i);
      expected.push(newNode.id());
      car.connect("f", newNode.neighbors().root());
    }
    const pgs = originalRoot.paintGroup().dump();
    assert.deepEqual(
      pgs.map((n) => n.id()),
      expected
    );
  });

  it("Disconnect parent test, creased removal with outer pg", function () {
    let car = makeCaret();
    const midRoot = car.spawnMove("i", "b");
    car.crease();
    const newNode = car.spawnMove("i", "b");
    car.crease();
    let pgs = car.root().paintGroup().dump();
    assert.deepEqual(
      pgs.map((n) => n.id()),
      [car.root().id(), midRoot.id(), newNode.id()]
    );

    midRoot.disconnectNode();
    assert.deepEqual(
      midRoot
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [midRoot.id(), newNode.id()]
    );

    car = makeCaret();
    const newRoot = car.node();
    car.connect("i", midRoot);

    pgs = car.root().paintGroup().dump();
    assert.deepEqual(
      pgs.map((n) => n.id()),
      [newRoot.id(), midRoot.id(), newNode.id()]
    );
  });

  it("Disconnect parent test, creased removal with outer pg", function () {
    const car = makeCaret();
    car.spawnMove("f", "s");
    const hello = new DirectionNode();
    car.node().connectNode(Direction.INWARD, hello);

    const notime = new DirectionNode();
    hello.connectNode(Direction.FORWARD, notime);

    const ccar = makeCaret();
    const there = ccar.spawnMove("i", "b");
    ccar.crease();
    car.connect("f", ccar.root());

    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id(), there.id()]
    );
  });

  it("simple inner paint group removal", function () {
    const containerBlock = new DirectionNode().setId("containerBlock");
    const icar = makeCaret();
    const objectNode = icar.root().setId("objectNode");
    containerBlock.connectNode(Direction.INWARD, icar.root());
    assert.deepEqual(
      icar
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [containerBlock.id()],
      "Inner paint group before crease"
    );
    assert.deepEqual(
      [containerBlock, containerBlock],
      findPaintGroupInsert(containerBlock, icar.node())
    );
    assert.deepEqual(icar.node().neighbors().root().id(), containerBlock.id());

    // connect containerBlock to objectNode
    // connect objectNode to containerBlock
    icar.crease();
    assert.deepEqual(
      containerBlock
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [containerBlock.id(), objectNode.id()],
      "Inner paint group after crease"
    );
  });

  it("inner paint group removal", function () {
    const car = makeCaret();
    const root = car.root().setId("root");
    car.pull("f");

    const acar = makeCaret();
    acar.spawnMove("i", "u");
    const arrayNode = acar.node().setId("array");
    acar.crease();
    acar.spawnMove("f", "b");
    acar.spawnMove("f", "u");

    car.connect("f", acar.root());

    car.spawnMove("d", "u");
    car.spawnMove("d", "u");
    car.spawn("f", "b");
    car.spawn("d", "u");

    // Now we have the initial layout, add the object.
    car.moveToRoot();
    assert.deepEqual(car.node(), root);
    car.disconnect("d");
    car.pull("f");
    car.connect("f", acar.root());
    car.spawnMove("d", "u");
    car.spawnMove("d", "u");

    const containerBlock = new DirectionNode().setId("containerBlock");
    const icar = makeCaret();
    containerBlock.connectNode(Direction.INWARD, icar.root());
    icar.crease();
    const objectNode = icar.node().setId("object");
    icar.spawnMove("d", "u");
    icar.spawn("b", "b");
    icar.spawn("f", "b");
    icar.spawn("d", "u");
    assert.deepEqual(
      containerBlock
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [containerBlock.id(), objectNode.id()],
      "Inner paint group"
    );
    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id(), arrayNode.id()],
      "Paint group should only contain 2 groups"
    );
    car.connect("f", containerBlock);

    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id(), arrayNode.id(), objectNode.id()],
      "Paint group should only contain 3 groups"
    );
  });

  it("double-nested array addition", function () {
    const car = makeCaret();
    car.root().setId("root");
    car.pull("f");

    car.spawn("u", "u");
    // first
    car.push();
    car.spawnMove("f", "b");
    car.spawnMove("i", "u");
    car.crease();
    const firstArray = car.node().setId("firstArray");
    car.spawnMove("f", "b");
    car.spawnMove("f", "u");
    car.pop();

    // Second
    car.spawnMove("d", "u");
    car.save("second");
    car.push();
    car.spawnMove("f", "b");
    car.spawnMove("i", "u");
    car.crease();
    let secondArray = car.node().setId("secondArray");
    car.spawnMove("f", "b");
    car.spawnMove("f", "u");
    car.spawnMove("f", "b");
    car.spawnMove("f", "u");
    car.pop();

    // Third array
    car.spawnMove("d", "u");
    car.push();
    car.spawnMove("f", "b");
    car.spawnMove("i", "u");
    car.crease();
    const thirdArray = car.node().setId("thirdArray");
    car.spawnMove("f", "b");
    car.spawnMove("f", "u");
    car.pop();

    // Test paint groups are correct
    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id(), firstArray.id(), secondArray.id(), thirdArray.id()],
      "Inner paint group"
    );

    // Now, add a nested group
    car.restore("second");
    car.push();
    car.spawnMove("f", "b");
    car.spawnMove("i", "u");
    car.crease();
    secondArray = car.node().setId("secondArray");
    car.push();
    car.spawnMove("i", "b");
    car.spawnMove("i", "u");
    car.crease();
    const innerArray = car.node().setId("innerArray");
    car.pop();
    car.move("o");
    car.spawnMove("f", "u");
    car.spawnMove("f", "b");
    car.spawnMove("f", "u");
    car.pop();

    // Test paint groups are correct
    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [
        car.root().id(),
        firstArray.id(),
        secondArray.id(),
        innerArray.id(),
        thirdArray.id(),
      ],
      "Inner paint group"
    );

    // Third array
    car.spawnMove("d", "u");
    car.push();
    car.connect("f", thirdArray);
    car.pop();

    // Test paint groups are correct
    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [
        car.root().id(),
        firstArray.id(),
        secondArray.id(),
        innerArray.id(),
        thirdArray.id(),
      ],
      "Inner paint group"
    );
  });

  it("Layout disconnection test", function () {
    const car = makeCaret();
    car.spawnMove("f", "b");
    // car is [car.root()]-[b]

    const ccar = makeCaret();
    ccar.spawnMove("f", "b");
    const n = ccar.spawnMove("i", "s");
    ccar.crease();
    // ccar is [ccar.root()]-[[n]]

    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id()]
    );

    assert.deepEqual(
      ccar
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [ccar.root().id(), n.id()],
      "ccar should have itself and n as paint groups"
    );

    car.connect("f", ccar.root());
    // car is now [car.root()]-[ccar.root()]-[[n]]

    assert.notEqual(
      findPaintGroup(ccar.root()).id(),
      ccar.root().id(),
      "ccar's paint group is not itself"
    );
    assert.equal(
      findPaintGroup(ccar.root()).id(),
      car.root().id(),
      "ccar's paint group is root"
    );
    assert.equal(findPaintGroup(n).id(), n.id());

    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id(), n.id()]
    );

    // console.log("Testing layout disconnection");

    car.disconnect("f");
    // car is now [car.root()]

    assert.deepEqual(
      ccar
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [ccar.root().id(), n.id()],
      "ccar should have itself and n as paint groups"
    );

    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id()],
      "Old root should only have itself as a paint group"
    );
  });

  it("Layout failing test", function () {
    const car = makeCaret();
    car.spawnMove("f", "b");

    let n: DirectionNode | undefined = undefined;
    for (let i = 0; i < 5; ++i) {
      const ccar = makeCaret();
      ccar.spawnMove("f", "b");
      n = ccar.spawnMove("i", "s");
      ccar.crease();
      car.connect("f", ccar.root());
    }

    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id(), n?.id()]
    );
  });

  it("Disconnection paint group test", function () {
    const car = makeCaret();
    car.root().setId("root");
    const root = car.spawnMove("f", "b");
    const lisp = car.spawnMove("f", "s");
    lisp.setId("lisp");

    const r = car.spawnMove("i", "s");
    r.setId("r");
    car.crease();

    const b = car.spawnMove("i", "b");
    b.setId("b");
    car.crease();

    const c = car.spawnMove("f", "b");
    c.setId("c");
    c.crease();

    car.spawnMove("f", "b");

    r.disconnectNode(Direction.INWARD);
    // assert.notEqual(car.root().paintGroup().next().id(), b.id(), "First paint group after disconnection must not be b");
    assert.equal(
      car.root().paintGroup().next().id(),
      r.id(),
      "First paint group after disconnection is r"
    );
    assert.equal(
      r.paintGroup().next().id(),
      car.root().id(),
      "R's next paint group after disconnection is root"
    );

    r.connectNode(Direction.INWARD, c);
    assert.equal(
      c.paintGroup().next().id(),
      car.root().id(),
      "C after connection should go to root"
    );
    assert.equal(
      r.paintGroup().next().id(),
      c.id(),
      "R after C's inward connection should go to C"
    );

    assert.notEqual(
      car.root().paintGroup().next().id(),
      b.id(),
      "First paint group must not be b"
    );
    assert.equal(
      car.root().paintGroup().next().id(),
      r.id(),
      "First paint group is r"
    );
    assert.equal(r.paintGroup().next().id(), c.id(), "Second paint group is c");
    assert.equal(
      c.paintGroup().next().id(),
      car.root().id(),
      "Paint group after c is root"
    );
    root.connectNode(Direction.FORWARD, lisp);

    assert.deepEqual(
      car
        .root()
        .paintGroup()
        .dump()
        .map((n) => n.id()),
      [car.root().id(), r.id(), c.id()]
    );
  });
});

function getLayoutNodes(node: DirectionNode) {
  const list: DirectionNode[] = [];
  const orig = node;

  const MAX_SIBLINGS = 100000;
  let count = 0;
  do {
    node = node.siblings().next() as DirectionNode;
    for (let i = 0; i < list.length; ++i) {
      if (list[i] == node) {
        throw new Error("Layout list has loop");
      }
    }
    list.push(node);
    ++count;
    if (count > MAX_SIBLINGS) {
      throw new Error("Infinite loop");
    }
  } while (orig != node);
  return list;
}

function testLayoutNodes(expected: DirectionNode[], name?: string) {
  const node = expected[expected.length - 1];
  const nodes = getLayoutNodes(node);
  for (let i = 0; i < expected.length; ++i) {
    if (nodes[i] != expected[i]) {
      // console.log("TESTLAYOUTNODES");
      // console.log(nodes);
      throw new Error(
        (name ? name : "") +
          " index " +
          i +
          ": Node " +
          (expected[i] ? expected[i].id() : "null") +
          " expected, not " +
          (nodes[i] ? nodes[i].id() : "null")
      );
    }
  }
}
