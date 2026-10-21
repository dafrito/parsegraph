import {
  Alignment,
  AxisOverlap,
  CommitLayout,
  Direction,
  DirectionNode,
  Fit,
  PreferredAxis,
} from "..";

describe("DirectionNode native port regressions", () => {
  it("remeasures a committed root after it becomes a child", () => {
    const formerRoot = new DirectionNode();
    formerRoot.paintGroups().crease();
    const measured: DirectionNode[] = [];
    const commit = (root: DirectionNode) => {
      const job = new CommitLayout(root, {
        size: (node, out) => {
          measured.push(node);
          out[0] = node.neighbors().isRoot() ? 100 : 20;
          out[1] = 30;
        },
        getSeparation: () => 0,
      });
      let steps = 0;
      while (job.crank()) expect(++steps).toBeLessThan(100);
    };
    commit(formerRoot);
    const size: number[] = [];
    formerRoot.layout().size(size);
    expect(size).toEqual([100, 30]);
    measured.length = 0;
    const newRoot = new DirectionNode();
    newRoot.connect(Direction.FORWARD, formerRoot);
    commit(newRoot);
    expect(measured).toEqual([formerRoot, newRoot]);
    formerRoot.layout().size(size);
    expect(size).toEqual([20, 30]);
    expect(formerRoot.layout().absoluteX()).toBe(60);
  });
  it("invalidates rootlike geometry when preference normalization preserves sibling order", () => {
    const parent = new DirectionNode([100, 100]);
    const inner = new DirectionNode([10, 10]);
    const up = inner.connect(Direction.UPWARD, new DirectionNode([100, 10]));
    const forward = inner.connect(
      Direction.FORWARD,
      new DirectionNode([10, 100])
    );
    for (const node of [parent, inner, up, forward]) node.setNodeFit(Fit.EXACT);
    inner.siblings().setLayoutPreference(PreferredAxis.VERTICAL);
    parent.connect(Direction.INWARD, inner);
    const commit = () => {
      const job = new CommitLayout(parent, {
        size: (node, out) => {
          [out[0], out[1]] = node.value();
        },
        getSeparation: () => 0,
      });
      let steps = 0;
      while (job.crank()) expect(++steps).toBeLessThan(100);
    };
    commit();
    expect(inner.neighbors().at(Direction.UPWARD).yPos()).toBe(-10);
    expect(inner.neighbors().at(Direction.FORWARD).xPos()).toBe(55);
    const order = inner.siblings().layoutOrder();
    inner.siblings().setLayoutPreference(PreferredAxis.VERTICAL);
    expect(inner.siblings().getLayoutPreference()).toBe(
      PreferredAxis.PERPENDICULAR
    );
    expect(inner.siblings().layoutOrder()).toBe(order);
    commit();
    expect(inner.neighbors().at(Direction.UPWARD).yPos()).toBe(-55);
    expect(inner.neighbors().at(Direction.FORWARD).xPos()).toBe(10);
  });
  it.each([false, true])(
    "refreshes detached and reattached subtree transforms with explicit group = %s",
    (explicit) => {
      const painter = {
        size: (_node: DirectionNode, out: number[]) => {
          out[0] = 24;
          out[1] = 80;
        },
        getSeparation: () => 0,
      };
      const commit = (node: DirectionNode) => {
        const job = new CommitLayout(node, painter);
        let steps = 0;
        while (job.crank()) expect(++steps).toBeLessThan(100);
      };
      const root = new DirectionNode("root");
      const child = root.connect(Direction.FORWARD, new DirectionNode("child"));
      child.setScale(2);
      if (explicit) child.paintGroups().crease();
      const nested = child.connect(
        Direction.DOWNWARD,
        new DirectionNode("nested")
      );
      nested.setScale(0.5);
      nested.paintGroups().crease();
      const leaf = nested.connect(Direction.FORWARD, new DirectionNode("leaf"));
      leaf.setScale(3);
      commit(root);
      child.disconnect();
      commit(child);
      const nestedOffset = child.neighbors().at(Direction.DOWNWARD).yPos();
      const leafOffset = nested.neighbors().at(Direction.FORWARD).xPos();
      expect(child.layout().absoluteX()).toBe(0);
      expect(child.layout().absoluteY()).toBe(0);
      expect(child.layout().absoluteScale()).toBe(1);
      expect(nested.layout().absoluteX()).toBe(0);
      expect(nested.layout().absoluteY()).toBe(nestedOffset);
      expect(nested.layout().absoluteScale()).toBe(0.5);
      expect(leaf.layout().absoluteX()).toBe(leafOffset * 0.5);
      expect(leaf.layout().absoluteY()).toBe(nestedOffset);
      expect(leaf.layout().absoluteScale()).toBe(1.5);
      root.connect(Direction.DOWNWARD, child);
      commit(root);
      const childOffset = root.neighbors().at(Direction.DOWNWARD).yPos();
      const attachedNestedOffset = child
        .neighbors()
        .at(Direction.DOWNWARD)
        .yPos();
      expect(child.layout().absoluteX()).toBe(0);
      expect(child.layout().absoluteY()).toBe(childOffset);
      expect(child.layout().absoluteScale()).toBe(2);
      expect(nested.layout().absoluteY()).toBe(
        childOffset + 2 * attachedNestedOffset
      );
      expect(leaf.layout().absoluteX()).toBe(leafOffset);
      expect(leaf.layout().absoluteY()).toBe(
        childOffset + 2 * attachedNestedOffset
      );
      expect(leaf.layout().absoluteScale()).toBe(3);
    }
  );
  const nestedPaintGroups = () => {
    const root = new DirectionNode("root");
    const a = root.connect(Direction.FORWARD, new DirectionNode("a"));
    a.siblings().setLayoutPreference(PreferredAxis.VERTICAL);
    const b = a.connect(Direction.DOWNWARD, new DirectionNode("b"));
    const d = b.connect(Direction.DOWNWARD, new DirectionNode("d"));
    const c = a.connect(Direction.FORWARD, new DirectionNode("c"));
    d.paintGroups().crease();
    c.paintGroups().crease();
    a.paintGroups().crease();
    return root;
  };

  it("inserts an ancestor paint group before all its descendant groups", () => {
    const root = nestedPaintGroups();
    expect(
      root
        .paintGroup()
        .dump()
        .map((node) => node.value())
    ).toEqual(["root", "a", "d", "c"]);
  });

  it("finishes layout when a new paint group contains existing descendant groups", () => {
    const root = nestedPaintGroups();
    const job = new CommitLayout(root, {
      size: (_node, out) => {
        out[0] = 24;
        out[1] = 80;
      },
      getSeparation: () => 3,
    });
    let steps = 0;
    while (steps < 100 && job.crank()) ++steps;
    expect(steps).toBeLessThan(100);
  });

  it.each([PreferredAxis.HORIZONTAL, PreferredAxis.VERTICAL])(
    "keeps descendant groups contiguous after changing preferred axis from %s",
    (initial) => {
      const root = new DirectionNode("root");
      root.siblings().setLayoutPreference(initial);
      const a = root.connect(Direction.FORWARD, new DirectionNode("a"));
      const descendant = a.connect(
        Direction.FORWARD,
        new DirectionNode("descendant")
      );
      const sibling = root.connect(
        Direction.DOWNWARD,
        new DirectionNode("sibling")
      );
      descendant.paintGroups().crease();
      sibling.paintGroups().crease();
      root
        .siblings()
        .setLayoutPreference(
          initial === PreferredAxis.HORIZONTAL
            ? PreferredAxis.VERTICAL
            : PreferredAxis.HORIZONTAL
        );
      a.paintGroups().crease();
      const groups = root.paintGroup().dump();
      expect(groups.indexOf(a)).toBeLessThan(groups.indexOf(descendant));
      a.disconnect();
      expect(a.paintGroup().dump()).toEqual([a, descendant]);
      expect(root.paintGroup().dump()).toEqual([root, sibling]);
    }
  );
  it("finds a root's first descendant without requiring a parent", () => {
    const root = new DirectionNode("root");
    const child = root.connect(Direction.FORWARD, new DirectionNode("child"));
    expect(root.siblings().head()).toBe(child);
  });

  it("changes an inward node's preferred axis without corrupting its sibling ring", () => {
    const root = new DirectionNode("root");
    const inner = root.connect(Direction.INWARD, new DirectionNode("inner"));
    inner.connect(Direction.DOWNWARD, new DirectionNode("downward"));
    inner.connect(Direction.FORWARD, new DirectionNode("forward"));
    inner.siblings().setLayoutPreference(PreferredAxis.PARENT);
    expect(
      root
        .siblings()
        .dump()
        .map((node) => node.value())
    ).toEqual(["downward", "forward", "inner", "root"]);
    inner.siblings().setLayoutPreference(PreferredAxis.PERPENDICULAR);
    expect(
      root
        .siblings()
        .dump()
        .map((node) => node.value())
    ).toEqual(["forward", "downward", "inner", "root"]);
  });
  it("retains every sibling when attaching a vertical subtree inward", () => {
    const root = new DirectionNode("root");
    const inner = new DirectionNode("inner");
    const forward = new DirectionNode("forward");
    const downward = new DirectionNode("downward");
    inner.siblings().setLayoutPreference(PreferredAxis.VERTICAL);
    inner.connect(Direction.FORWARD, forward);
    inner.connect(Direction.DOWNWARD, downward);
    expect(
      inner
        .siblings()
        .dump()
        .map((node) => node.value())
    ).toEqual(["downward", "forward", "inner"]);
    root.connect(Direction.INWARD, inner);
    expect(
      root
        .siblings()
        .dump()
        .map((node) => node.value())
    ).toEqual(["forward", "downward", "inner", "root"]);
    expect(downward.neighbors().parentNode()).toBe(inner);
  });

  it("reorders an inward subtree when detaching changes its effective preferred axis", () => {
    const root = new DirectionNode("root");
    const inner = root.connect(Direction.INWARD, new DirectionNode("inner"));
    inner.siblings().setLayoutPreference(PreferredAxis.PARENT);
    inner.connect(Direction.FORWARD, new DirectionNode("forward"));
    inner.connect(Direction.DOWNWARD, new DirectionNode("downward"));
    root.disconnect(Direction.INWARD);
    expect(inner.siblings().getLayoutPreference()).toBe(
      PreferredAxis.HORIZONTAL
    );
    expect(
      inner
        .siblings()
        .dump()
        .map((node) => node.value())
    ).toEqual(["forward", "downward", "inner"]);
    expect(root.siblings().dump()).toEqual([root]);
  });

  it("finds the parent even when that direction has a preconfigured empty slot", () => {
    const root = new DirectionNode();
    const child = new DirectionNode();
    child.neighbors().align(Direction.BACKWARD, Alignment.CENTER);
    root.connect(Direction.FORWARD, child);
    expect(child.neighbors().hasNode(Direction.BACKWARD)).toBe(true);
    expect(child.neighbors().nodeAt(Direction.BACKWARD)).toBe(root);
    expect(child.neighbors().hasChildAt(Direction.BACKWARD)).toBe(false);
  });

  it("reads alignment from the parent connection", () => {
    const root = new DirectionNode();
    const child = root.connect(Direction.FORWARD, new DirectionNode());
    root.neighbors().align(Direction.FORWARD, Alignment.CENTER);
    expect(child.neighbors().getAlignment(Direction.BACKWARD)).toBe(
      Alignment.CENTER
    );
  });

  it("reads axis overlap from the parent connection", () => {
    const root = new DirectionNode();
    const child = root.connect(Direction.FORWARD, new DirectionNode());
    root.neighbors().setAxisOverlap(Direction.FORWARD, AxisOverlap.PREVENTED);
    expect(child.neighbors().axisOverlap(Direction.BACKWARD)).toBe(
      AxisOverlap.PREVENTED
    );
  });

  it("reads line length from the parent connection", () => {
    const root = new DirectionNode();
    const child = root.connect(Direction.FORWARD, new DirectionNode());
    root.neighbors().at(Direction.FORWARD).setLineLength(123);
    expect(child.neighbors().lineLengthAt(Direction.BACKWARD)).toBe(123);
  });

  it("updates the parent connection through its explicit direction", () => {
    const root = new DirectionNode();
    const child = root.connect(Direction.FORWARD, new DirectionNode());
    child.neighbors().align(Direction.BACKWARD, Alignment.POSITIVE);
    child.neighbors().setAxisOverlap(Direction.BACKWARD, AxisOverlap.ALLOWED);
    expect(root.neighbors().getAlignment(Direction.FORWARD)).toBe(
      Alignment.POSITIVE
    );
    expect(root.neighbors().axisOverlap(Direction.FORWARD)).toBe(
      AxisOverlap.ALLOWED
    );
  });
});
