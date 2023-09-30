import { assert } from "chai";
import { Direction, DirectionNode } from "..";

describe("DirectionNode", () => {
  it("connectNode", () => {
    const root = new DirectionNode("root");
    assert.isTrue(root.neighbors().isRoot());
    const child = new DirectionNode("child");
    assert.isTrue(child.neighbors().isRoot());
    root.connectNode(Direction.BACKWARD, child);
    assert.isFalse(child.neighbors().isRoot());
  });
});