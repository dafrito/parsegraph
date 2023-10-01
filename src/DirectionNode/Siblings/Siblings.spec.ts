import { assert } from "chai";
import { Direction, DirectionNode, PreferredAxis } from "../..";

describe("Siblings", () => {
  it("keeps non-root PreferredAxis when connecting or disconnecting", () => {
    const n = new DirectionNode();
    n.siblings().pull(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);

    const root = new DirectionNode();
    root.connect(Direction.DOWNWARD, n);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);

    root.disconnect(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);
  });

  it("converts a non-root PreferredAxis to a root PreferredAxis", () => {
    const n = new DirectionNode();
    n.siblings().pull(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);

    const root = new DirectionNode();
    root.connect(Direction.DOWNWARD, n);

    n.siblings().pull(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.PARENT);

    root.disconnect(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);
  });
});
