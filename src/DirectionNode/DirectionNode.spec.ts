import { assert } from "chai";
import { Direction, DirectionNode } from "..";

describe("DirectionNode", () => {
  it("connect", () => {
    const root = new DirectionNode("root");
    assert.isTrue(root.neighbors().isRoot());
    const child = new DirectionNode("child");
    assert.isTrue(child.neighbors().isRoot());
    root.connect(Direction.BACKWARD, child);
    assert.isFalse(child.neighbors().isRoot());
  });
});
