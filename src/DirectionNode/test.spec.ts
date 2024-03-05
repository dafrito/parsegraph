import { expect, assert } from "chai";
import { Direction, readDirection } from "../../src/Direction";

import {
  DirectionNode,
} from "../../src/DirectionNode";
import { DirectionCaret } from "..";

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
    const caret = new DirectionCaret();

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
    const caret = new DirectionCaret();

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
    const caret = new DirectionCaret();
    const creased = caret.spawnMove(Direction.FORWARD);
    caret.crease();
    const grandchild = caret.spawnMove(Direction.FORWARD);
    caret.moveTo(caret.root());
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
    const caret = new DirectionCaret();
    const root = caret.root();

    const creased = caret.spawnMove(Direction.FORWARD);
    caret.crease();
    caret.spawnMove(Direction.FORWARD);
    creased.paintGroups().uncrease();

    expect(creased.paintGroups().isPaintGroup()).to.equal(false);
    expect(creased.paintGroups().isPaintGroup()).to.equal(false);
    expect(root.paintGroups().isPaintGroup()).to.not.equal(false);
    expect(root.paintGroup()?.next()).to.equal(root);
    expect(root.paintGroup()?.prev()).to.equal(root);
  });

  it("Viewport - Block with forward bud, removed", function () {
    // Spawn the graph.
    const caret = new DirectionCaret();
    const root = caret.root();
    const child = caret.spawnMove(Direction.FORWARD);
    caret.spawnMove(Direction.FORWARD);
    expect(child.paintGroups().isPaintGroup()).to.equal(false);
    expect(root.paintGroup()?.next()).to.not.equal(child);
    expect(root.paintGroup()?.next()).to.equal(root);

    child.disconnect();
    expect(child.paintGroups().isPaintGroup()).to.not.equal(false);

    expect(root.paintGroups().isPaintGroup()).to.not.equal(false);
    expect(
      root.paintGroup()?.next(),
      "Root's paint group should not be child"
    ).to.not.equal(child);

    expect(root.paintGroup()?.next()).to.equal(root);
    expect(root.paintGroup()?.prev()).to.not.equal(child);
    expect(root.paintGroup()?.prev()).to.equal(root);
  });

  it("Node Morris world threading spawned", function () {
    const n = new DirectionNode();
    n.connect(Direction.FORWARD, new DirectionNode());
  });
});