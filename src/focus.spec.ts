import {
  DirectionNode,
  DirectionCaret,
  Direction as D,
  CommitLayout,
  LayoutPhase,
  serializeParsegraphDocument,
  deserializeParsegraphDocument,
  validateParsegraphDocument,
} from "./index";

function fixture() {
  const nodes = Array.from(
    { length: 6 },
    (_, i) => new DirectionNode([20 + i * 4, 10 + i * 2])
  );
  const [root, down, up, forward, nested, inward] = nodes;
  root.connect(D.DOWNWARD, down);
  root.connect(D.UPWARD, up);
  root.connect(D.FORWARD, forward);
  down.connect(D.FORWARD, nested);
  nested.connect(D.INWARD, inward);
  down.setScale(0.5);
  nested.setScale(2);
  inward.setScale(0.25);
  down.paintGroups().crease();
  nested.paintGroups().crease();
  const commit = () => {
    const layout = new CommitLayout(root, {
      size: (node, out) => {
        out[0] = node.value()[0];
        out[1] = node.value()[1];
      },
      getSeparation: () => 4,
    });
    let steps = 0;
    while (layout.crank()) {
      if (++steps > 10000) throw new Error("layout stalled");
    }
  };
  commit();
  return { nodes, root, down, up, forward, nested, inward, commit };
}

function union(nodes: DirectionNode[]) {
  const rects = nodes.map((n) => {
    const l = n.layout(),
      size = [0, 0];
    l.size(size);
    return [
      l.absoluteX() - (size[0] * l.absoluteScale()) / 2,
      l.absoluteY() - (size[1] * l.absoluteScale()) / 2,
      l.absoluteX() + (size[0] * l.absoluteScale()) / 2,
      l.absoluteY() + (size[1] * l.absoluteScale()) / 2,
    ];
  });
  return {
    left: Math.min(...rects.map((r) => r[0])),
    top: Math.min(...rects.map((r) => r[1])),
    right: Math.max(...rects.map((r) => r[2])),
    bottom: Math.max(...rects.map((r) => r[3])),
  };
}

describe("directional focus", () => {
  it("unions selected branches across groups, includes nested content, and ignores descendant focus", () => {
    const { root, down, up, nested, inward } = fixture();
    down.setFocus();
    root.setFocus(D.DOWNWARD, D.UPWARD);
    expect(root.layout().focusBounds()).toEqual(
      union([root, down, up, nested, inward])
    );
    expect(root.layout().boundsForDirections(D.DOWNWARD)).toEqual(
      union([root, down, nested, inward])
    );
    expect(nested.layout().boundsForDirections(D.INWARD)).toEqual(
      union([nested, inward])
    );
    expect(root.layout().boundsForDirections(D.BACKWARD)).toEqual(
      union([root])
    );
  });
  it("replaces selections, distinguishes unset and empty, and does not change layout", () => {
    const { root, nodes, down, nested, inward } = fixture();
    const before = nodes.map((n) => [
      n.layout().absoluteX(),
      n.layout().absoluteY(),
      n.layout().absoluteScale(),
    ]);
    const caret = new DirectionCaret(root);
    expect(root.focusDirections()).toBeUndefined();
    expect(root.layout().focusBounds(D.DOWNWARD)).toEqual(
      union([root, down, nested, inward])
    );
    caret.focus("d", D.UPWARD, D.DOWNWARD);
    expect(root.focusDirections()).toEqual([D.DOWNWARD, D.UPWARD]);
    const copy = root.focusDirections();
    copy.push(D.FORWARD);
    expect(root.focusDirections()).toEqual([D.DOWNWARD, D.UPWARD]);
    caret.focus();
    expect(root.layout().focusBounds(D.DOWNWARD)).toEqual(union([root]));
    caret.focus(D.UPWARD);
    expect(root.focusDirections()).toEqual([D.UPWARD]);
    caret.move(D.DOWNWARD);
    caret.focus(D.FORWARD);
    expect(root.focusDirections()).toEqual([D.UPWARD]);
    caret.clearFocus();
    expect(down.focusDirections()).toBeUndefined();
    expect(
      nodes.map((n) => [
        n.layout().absoluteX(),
        n.layout().absoluteY(),
        n.layout().absoluteScale(),
      ])
    ).toEqual(before);
    expect(
      nodes.every((n) => n.layout().phase() === LayoutPhase.COMMITTED)
    ).toBe(true);
  });
  it("rejects invalid selections atomically, dirty geometry, and stale intent after reparenting", () => {
    const { root, down, commit } = fixture();
    down.setFocus(D.FORWARD);
    for (const d of [D.UPWARD, D.OUTWARD, -1, 6, 2.5, NaN]) {
      expect(() => down.setFocus(d)).toThrow();
      expect(down.focusDirections()).toEqual([D.FORWARD]);
      expect(() => down.layout().boundsForDirections(d)).toThrow();
    }
    root.invalidate();
    expect(() => down.layout().focusBounds()).toThrow(/completed layout/);
    commit();
    root.setFocus(D.DOWNWARD);
    const parent = new DirectionNode();
    parent.connect(D.UPWARD, root);
    expect(() => root.layout().focusBounds()).toThrow(/child-facing/);
  });
  it("recomputes bounds after resize and branch removal without stale focus caches", () => {
    const { root, down, up, nested, inward, commit } = fixture();
    root.setFocus(D.DOWNWARD, D.UPWARD);
    const before = root.layout().focusBounds();
    inward.setValue([1000, 2000]);
    expect(() => root.layout().focusBounds()).toThrow();
    commit();
    expect(root.layout().focusBounds()).toEqual(
      union([root, down, up, nested, inward])
    );
    expect(root.layout().focusBounds()).not.toEqual(before);
    root.disconnect(D.DOWNWARD);
    commit();
    expect(root.layout().focusBounds()).toEqual(union([root, up]));
  });

  it("round trips focus/1, including empty entries, clears stale options, and accepts reordered records", () => {
    const { root, down } = fixture();
    root.setId("__proto__");
    root.setFocus(D.UPWARD, D.DOWNWARD);
    down.setFocus();
    const doc = serializeParsegraphDocument(root);
    doc.nodes.reverse();
    const loaded = deserializeParsegraphDocument(doc);
    expect(loaded.ignoredCapabilities).toEqual([]);
    expect(loaded.root.focusDirections()).toEqual([D.DOWNWARD, D.UPWARD]);
    expect(
      loaded.root.neighbors().nodeAt(D.DOWNWARD).focusDirections()
    ).toEqual([]);
    expect(
      serializeParsegraphDocument(loaded.root, loaded).capabilities
    ).toEqual(doc.capabilities);
    loaded.root.clearFocus();
    const saved = serializeParsegraphDocument(loaded.root, loaded);
    expect(
      Object.prototype.hasOwnProperty.call(
        (saved.capabilities["focus/1"] as any).nodeDirections,
        "__proto__"
      )
    ).toBe(false);
    expect(
      serializeParsegraphDocument(new DirectionNode()).capabilities["focus/1"]
    ).toBeUndefined();
  });
  it("rejects malformed capability records and parent selections before loading", () => {
    const { root, down } = fixture();
    root.setId("root");
    down.setId("down");
    for (const payload of [
      null,
      { nodeDirections: { missing: [] as string[] } },
      { nodeDirections: { root: ["outward"] } },
      { nodeDirections: { root: ["downward", "downward"] } },
      { nodeDirections: { root: "downward" } },
      { nodeDirections: { down: ["upward"] } },
      { nodeDirections: { root: [] as string[] }, extra: true },
    ]) {
      const doc = serializeParsegraphDocument(root);
      doc.capabilities["focus/1"] = payload as any;
      expect(() => validateParsegraphDocument(doc)).toThrow();
      expect(() => deserializeParsegraphDocument(doc)).toThrow();
    }
  });
});
