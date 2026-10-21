import { CommitLayout } from "./CommitLayout";
import { Alignment, Direction, DirectionNode, Fit } from "../../..";

const layout = (root: DirectionNode) => {
  const commit = new CommitLayout(root, {
    size: (_node, out) => {
      out[0] = 24;
      out[1] = 80;
    },
  });
  let steps = 0;
  while (commit.crank()) {
    if (++steps > 1000) throw new Error("Layout did not finish");
  }
};

describe("CommitLayout regressions", () => {
  it("initializes positions for a newly constructed naive root", () => {
    const root = new DirectionNode();
    root.setNodeFit(Fit.NAIVE);
    const child = new DirectionNode();
    root.connect(Direction.FORWARD, child);

    layout(root);
    expect(child.neighbors().parentX()).toBe(24);
    expect(child.neighbors().parentY()).toBe(0);
    expect(child.layout().absoluteX()).toBe(24);
    expect(child.layout().absoluteY()).toBe(0);
  });

  it("positions new children on an already positioned naive node", () => {
    const root = new DirectionNode();
    const child = new DirectionNode();
    root.connect(Direction.FORWARD, child);
    child.setNodeFit(Fit.NAIVE);
    layout(root);

    const grandchild = new DirectionNode();
    child.connect(Direction.DOWNWARD, grandchild);
    layout(root);
    expect(grandchild.neighbors().parentX()).toBe(0);
    expect(grandchild.neighbors().parentY()).toBe(80);
    expect(Number.isFinite(grandchild.layout().absoluteX())).toBe(true);
    expect(Number.isFinite(grandchild.layout().absoluteY())).toBe(true);
  });

  it("preserves existing naive positions when dimensions change", () => {
    const root = new DirectionNode();
    const child = new DirectionNode();
    root.connect(Direction.FORWARD, child);
    layout(root);
    root.setNodeFit(Fit.NAIVE);
    const commit = new CommitLayout(root, {
      size: (_node, out) => {
        out[0] = 100;
        out[1] = 100;
      },
    });
    while (commit.crank()) {
      // Finish the incremental layout.
    }
    expect(child.neighbors().parentX()).toBe(24);
    expect(child.neighbors().parentY()).toBe(0);
  });

  it("separates aligned opposing subtrees with different scales", () => {
    const root = new DirectionNode([10, 10]);
    const right = new DirectionNode([10, 10]);
    const left = new DirectionNode([20, 20]);
    const rightDown = new DirectionNode([10, 10]);
    const leftDown = new DirectionNode([20, 20]);
    const rightArm = new DirectionNode([200, 10]);
    const leftArm = new DirectionNode([400, 20]);
    for (const node of [
      root,
      right,
      left,
      rightDown,
      leftDown,
      rightArm,
      leftArm,
    ]) {
      node.setNodeFit(Fit.EXACT);
    }
    root.connect(Direction.FORWARD, right);
    root.connect(Direction.BACKWARD, left);
    right.connect(Direction.DOWNWARD, rightDown);
    left.connect(Direction.DOWNWARD, leftDown);
    rightDown.connect(Direction.BACKWARD, rightArm);
    leftDown.connect(Direction.FORWARD, leftArm);
    left.setScale(0.5);
    root.neighbors().align(Direction.FORWARD, Alignment.CENTER);
    root.neighbors().align(Direction.BACKWARD, Alignment.CENTER);
    const commit = new CommitLayout(root, {
      size: (node, out) => {
        [out[0], out[1]] = node.value();
      },
      getSeparation: (node, _axis, dir) => {
        if (dir !== Direction.DOWNWARD) return 0;
        return node === right ? 90 : node === left ? 180 : 0;
      },
    });
    while (commit.crank()) {
      // Complete the layout, including paint-group transforms.
    }
    // Both arms are physically 200 by 10 and occupy the same vertical span.
    // Their opposite horizontal edges must meet without overlapping.
    expect(rightArm.layout().absoluteY()).toBe(50);
    expect(leftArm.layout().absoluteY()).toBe(50);
    const rightArmLeftEdge = rightArm.layout().absoluteX() - 100;
    const leftArmRightEdge = leftArm.layout().absoluteX() + 100;
    expect(rightArmLeftEdge).toBeGreaterThanOrEqual(leftArmRightEdge);
    expect(right.neighbors().parentX()).toBe(205);
    expect(left.neighbors().parentX()).toBe(-205);
  });
});
