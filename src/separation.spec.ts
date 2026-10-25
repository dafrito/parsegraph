import {
  DirectionNode,
  DirectionCaret,
  Direction as D,
  Fit,
  PreferredAxis,
  CommitLayout,
  serializeParsegraphDocument,
  deserializeParsegraphDocument,
  validateParsegraphDocument,
  serializeParsegraph,
  deserializeParsegraph,
} from "./index";
import { Extent } from "./DirectionNode/Layout/Extent";
import { separateExtents } from "./DirectionNode/Layout/CommitLayout/separateExtents";

function fixture(pull = D.DOWNWARD, opposite = false) {
  const sizes = [
    [10, 10],
    [10, 100],
    [100, 10],
    [10, 10],
    [10, 20],
    [100, 10],
    [10, 10],
    [10, 50],
    [80, 10],
  ];
  const nodes = sizes.slice(0, opposite ? 9 : 6).map((size, i) => {
    const node = new DirectionNode(size);
    node.setId(String(i));
    node.setNodeFit(Fit.EXACT);
    return node;
  });
  const [root, down, arm, next, short, other] = nodes;
  root.connect(D.DOWNWARD, down);
  down.connect(D.FORWARD, arm);
  root.connect(D.FORWARD, next);
  next.connect(D.DOWNWARD, short);
  short.connect(D.FORWARD, other);
  if (opposite) {
    root.connect(D.BACKWARD, nodes[6]);
    nodes[6].connect(D.DOWNWARD, nodes[7]);
    nodes[7].connect(D.BACKWARD, nodes[8]);
    nodes[6].setScale(0.5);
  }
  const caret = new DirectionCaret(root);
  caret.pull(pull);
  return { nodes, root, caret };
}
function layout(root: DirectionNode) {
  const job = new CommitLayout(root, {
    size: (n, out) => {
      out[0] = n.value()[0];
      out[1] = n.value()[1];
    },
  });
  let steps = 0;
  while (job.crank()) if (++steps > 10000) throw new Error("layout stalled");
}
function positions(nodes: DirectionNode[]) {
  return nodes.map((n) => [n.layout().absoluteX(), n.layout().absoluteY()]);
}

test("boxed comparison matches simplified extents, preserves contours, and handles offsets/scales/gaps", () => {
  const a = new Extent(),
    b = new Extent();
  a.appendLS(10, 2);
  a.appendLS(15, 20);
  a.appendLS(5, NaN);
  b.appendLS(5, 30);
  b.appendLS(12, 1);
  const ac = a.clone(),
    bc = b.clone();
  ac.simplify();
  bc.simplify();
  const beforeA = a.clone(),
    beforeB = b.clone();
  for (const offset of [-100, -30, -17, -5, 0, 8, 30, 100])
    for (const scale of [0.5, 1, 2])
      for (const overlap of [false, true]) {
        expect(
          separateExtents(a, b, offset, overlap, scale, Fit.LOOSE)
        ).toBeCloseTo(ac.separation(bc, offset, overlap, scale), 8);
      }
  expect(a.equals(beforeA)).toBe(true);
  expect(b.equals(beforeB)).toBe(true);
});

test("loosen resolves the perpendicular axis now; tighten is a setter, not undo", () => {
  const { root, caret } = fixture();
  caret.loosen();
  expect(root.separationFit(D.FORWARD)).toBe(Fit.LOOSE);
  expect(root.separationFit(D.BACKWARD)).toBe(Fit.LOOSE);
  expect(root.separationFit(D.DOWNWARD)).toBe(Fit.EXACT);
  expect(root.nodeFit()).toBe(Fit.EXACT);
  caret.pull(D.FORWARD);
  caret.tighten();
  expect(root.separationFit(D.FORWARD)).toBe(Fit.LOOSE);
  caret.pull(D.DOWNWARD);
  caret.tighten();
  expect(root.separationFit(D.FORWARD)).toBe(Fit.EXACT);
  for (const d of [D.INWARD, D.OUTWARD, 6, 2.5, NaN])
    expect(() => root.setSeparationFit(d, Fit.LOOSE)).toThrow();
  expect(() => root.setSeparationFit(D.FORWARD, Fit.NAIVE)).toThrow();
});

test("relative preferences, root defaults, and inward roots choose the actual second axis", () => {
  const root = new DirectionNode();
  const c = new DirectionCaret(root);
  c.loosen();
  expect(root.separationFit(D.DOWNWARD)).toBe(Fit.LOOSE);
  const child = new DirectionNode();
  root.connect(D.DOWNWARD, child);
  c.moveTo(child);
  c.pull(D.DOWNWARD);
  c.loosen();
  expect(child.separationFit(D.FORWARD)).toBe(Fit.LOOSE);
  c.pull(D.FORWARD);
  c.loosen();
  expect(child.separationFit(D.DOWNWARD)).toBe(Fit.LOOSE);
  const inward = new DirectionNode();
  root.connect(D.INWARD, inward);
  c.moveTo(inward);
  c.pull(D.DOWNWARD);
  c.loosen();
  expect(inward.separationFit(D.FORWARD)).toBe(Fit.LOOSE);
  expect(inward.siblings().getLayoutPreference()).toBe(PreferredAxis.VERTICAL);
});

test.each([false, true])(
  "loose spacing widens a multislot, keeps exact contours, and tightens reversibly (opposing=%s)",
  (opposite) => {
    const { root, caret, nodes } = fixture(D.DOWNWARD, opposite);
    layout(root);
    const original = positions(nodes);
    const childPositions = nodes
      .slice(1)
      .map((n) => [n.neighbors().parentX(), n.neighbors().parentY()]);
    caret.loosen();
    layout(root);
    expect(nodes[3].layout().absoluteX()).toBeGreaterThan(original[3][0]);
    expect(root.layout().extentsAt(D.FORWARD).numBounds()).toBeGreaterThan(1);
    for (const i of [1, 2, 4, 5])
      expect([
        nodes[i].neighbors().parentX(),
        nodes[i].neighbors().parentY(),
      ]).toEqual(childPositions[i - 1]);
    caret.tighten();
    layout(root);
    expect(positions(nodes)).toEqual(original);
    // A post-layout mutation invalidates ancestors, including across a paint group.
    nodes[3].paintGroups().crease();
    nodes[3].setValue([30, 10]);
    caret.loosen();
    layout(root);
    const exported = serializeParsegraphDocument(root),
      loaded = deserializeParsegraphDocument(exported).root;
    layout(loaded);
    expect(
      loaded.layout().boundsForDirections(D.DOWNWARD, D.FORWARD, D.BACKWARD)
    ).toEqual(
      root.layout().boundsForDirections(D.DOWNWARD, D.FORWARD, D.BACKWARD)
    );
  }
);

test("FORWARD-first loose FORWARD separation cannot reserve unplaced DOWNWARD content", () => {
  const { root, nodes } = fixture(D.FORWARD);
  layout(root);
  const x = nodes[3].layout().absoluteX();
  root.setSeparationFit(D.FORWARD, Fit.LOOSE);
  layout(root);
  expect(nodes[3].layout().absoluteX()).toBe(x);
  root.siblings().pull(D.DOWNWARD);
  layout(root);
  expect(nodes[3].layout().absoluteX()).toBeGreaterThan(x);
});

test("separation/1 round trips concrete directions and discards stale options; v0 remains legacy", () => {
  const { root, caret } = fixture();
  caret.loosen();
  const doc = serializeParsegraphDocument(root);
  expect(doc.capabilities["separation/1"]).toEqual({
    nodeDirections: { "0": ["forward", "backward"] },
  });
  const loaded = deserializeParsegraphDocument(doc);
  expect(loaded.ignoredCapabilities).toEqual([]);
  expect(loaded.root.separationFit(D.BACKWARD)).toBe(Fit.LOOSE);
  new DirectionCaret(loaded.root).tighten();
  expect(
    serializeParsegraphDocument(loaded.root, loaded).capabilities[
      "separation/1"
    ]
  ).toEqual({ nodeDirections: {} });
  expect(
    deserializeParsegraph(serializeParsegraph(root)).separationFit(D.FORWARD)
  ).toBe(Fit.EXACT);
  for (const nodeDirections of [
    { missing: ["forward"] },
    { "0": ["inward"] },
    { "0": ["forward", "forward"] },
    { "0": ["naive"] },
    { "0": null },
  ]) {
    expect(() =>
      validateParsegraphDocument({
        ...doc,
        capabilities: { "separation/1": { nodeDirections } },
      })
    ).toThrow();
  }
});

test.each([false, true])(
  "inward pull preserves absolute preference, traversal, and geometry (creased=%s)",
  (creased) => {
    const { root, caret, nodes } = fixture();
    const host = new DirectionNode([400, 400]);
    host.setId("host");
    if (creased) root.paintGroups().crease();
    host.connect(D.INWARD, root);
    const checkOrder = (vertical: boolean) => {
      expect(root.siblings().getLayoutPreference()).toBe(
        vertical ? PreferredAxis.VERTICAL : PreferredAxis.HORIZONTAL
      );
      expect(root.siblings().layoutOrder()[1]).toBe(
        vertical ? D.DOWNWARD : D.BACKWARD
      );
      const ring: DirectionNode[] = [];
      let n = root;
      do {
        ring.push(n);
        n = n.siblings().next();
        if (ring.length > 7) throw new Error("broken sibling ring");
      } while (n !== root);
      expect(new Set(ring).size).toBe(ring.length);
    };
    for (const direction of [D.FORWARD, D.DOWNWARD, D.FORWARD, D.DOWNWARD]) {
      caret.pull(direction);
      checkOrder(direction === D.DOWNWARD);
      layout(host);
    }
    const exact = positions(nodes);
    caret.loosen();
    layout(host);
    expect(root.separationFit(D.FORWARD)).toBe(Fit.LOOSE);
    expect(nodes[3].neighbors().parentX()).toBeGreaterThan(
      exact[3][0] - exact[0][0]
    );
    const document = serializeParsegraphDocument(host);
    const loaded = deserializeParsegraphDocument(document);
    const restored = loaded.root.neighbors().nodeAt(D.INWARD);
    expect(restored.siblings().getLayoutPreference()).toBe(
      PreferredAxis.VERTICAL
    );
    layout(loaded.root);
    expect(
      restored.neighbors().nodeAt(D.FORWARD).neighbors().parentX()
    ).toBeCloseTo(nodes[3].neighbors().parentX(), 8);
    const saved = serializeParsegraphDocument(loaded.root, loaded);
    expect(saved.nodes.find((n) => n.id === "0")).toEqual(
      document.nodes.find((n) => n.id === "0")
    );
    expect(saved.capabilities).toEqual(document.capabilities);
    caret.tighten();
    layout(host);
    expect(positions(nodes)).toEqual(exact);
    host.disconnect(D.INWARD);
    checkOrder(true);
    host.connect(D.DOWNWARD, root);
    caret.pull(D.DOWNWARD);
    expect(root.siblings().getLayoutPreference()).toBe(PreferredAxis.PARENT);
    host.connect(D.INWARD, root);
    checkOrder(true);
    layout(host);
    expect(positions(nodes)).toEqual(exact);
  }
);

test.each([PreferredAxis.PARENT, PreferredAxis.PERPENDICULAR])(
  "legacy inward relative preference %s keeps its order on detach",
  (preference) => {
    const { root, nodes } = fixture();
    const host = new DirectionNode([400, 400]);
    host.connect(D.INWARD, root);
    root.siblings().setLayoutPreference(preference);
    layout(host);
    const order = root.siblings().layoutOrder();
    const relative = nodes.map((n) => [
      n.layout().absoluteX() - root.layout().absoluteX(),
      n.layout().absoluteY() - root.layout().absoluteY(),
    ]);
    host.disconnect(D.INWARD);
    expect(root.siblings().layoutOrder()).toBe(order);
    layout(root);
    expect(positions(nodes)).toEqual(relative);
  }
);
