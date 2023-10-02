import { assert } from "chai";
import { DirectionCaret } from "./DirectionCaret";
import { Direction } from "./Direction/constants";
import { DirectionNode } from "./DirectionNode/DirectionNode";

describe("Caret", function () {
  it("spawnMove", () => {
    const car = new DirectionCaret("a");
    assert.equal(car.node().value(), "a");
    car.spawnMove("f", "b");
    assert.equal(car.node().value(), "b");
  });

  it("spawnMove", () => {
    const car = new DirectionCaret("root");
    car.node().setId("root");
    const n = car.node();
    car.spawnMove("f", "b");
    assert.notEqual(n.id(), car.node().id());
  });

  it("move()", () => {
    const root = new DirectionNode("root");
    root.setId("root");
    assert.isTrue(root.neighbors().isRoot());
    const child = new DirectionNode("child");
    child.setId("child");
    assert.isTrue(child.neighbors().isRoot());
    root.connect(Direction.BACKWARD, child);
    assert.isFalse(child.neighbors().isRoot());
    const car = new DirectionCaret(child);
    car.move(Direction.FORWARD);
    assert.equal(car.node().id(), "root");
    car.move(Direction.BACKWARD);
    assert.equal(car.node().id(), "child");
  });

  it("moving to root", () => {
    const car = new DirectionCaret("root");
    car.node().setId("root");
    const n = car.node();
    car.spawnMove("f", "b");
    assert.notEqual(n, car.node());
    car.node().setId("child");
    car.moveTo(car.root());
    assert.equal(car.value(), "root");
  });

  it("basic parent test", () => {
    const root = new DirectionNode("root");
    assert.isTrue(root.neighbors().isRoot());
    assert.isTrue(root.neighbors().isRootlike());
    const child = new DirectionNode("b");
    root.connect(Direction.FORWARD, child);
    assert.isFalse(child.neighbors().isRoot());
  });

  it("simple root test", () => {
    const car = new DirectionCaret("root");
    assert.isTrue(car.node().neighbors().isRoot());
    assert.isTrue(car.node().neighbors().isRootlike());
    car.spawnMove("f", "b");
    assert.isFalse(car.node().neighbors().isRoot());
    assert.isFalse(car.node().neighbors().isRootlike());
    car.spawnMove("i", "b");
    assert.isFalse(car.node().neighbors().isRoot());
    assert.isTrue(car.node().neighbors().isRootlike());
    car.moveTo(car.parent());
    assert.isFalse(car.node().neighbors().isRoot());
    assert.isFalse(car.node().neighbors().isRootlike());

    car.moveTo(car.root());
    assert.equal(car.value(), "root");
  });
});
