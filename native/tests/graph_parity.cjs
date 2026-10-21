const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("ts-node").register({
  project: path.resolve(__dirname, "../../examples/tsconfig.json"),
  transpileOnly: true,
});
const api = require("../../src");
const {
  DirectionNode,
  Direction: D,
  Axis,
  Fit,
  PreferredAxis: P,
  Alignment: A,
  AxisOverlap: O,
  CommitLayout,
} = api;
const dirs = [D.INWARD, D.DOWNWARD, D.UPWARD, D.FORWARD, D.BACKWARD];
const allNodes = (root) => {
  const out = [],
    stack = [root];
  while (stack.length) {
    const n = stack.pop();
    assert.ok(out.length < 10000, "traversal repeated");
    out.push(n);
    for (const d of dirs)
      if (n.neighbors().hasChild(d)) stack.push(n.neighbors().nodeAt(d));
  }
  return out;
};
let commands = [],
  cases = [],
  current;
const num = (v) => (Number.isNaN(v) ? "nan" : String(v));
const near = (a, b, label) => {
  if (Number.isNaN(b))
    assert.ok(Number.isNaN(a), label + " expected NaN, got " + a);
  else
    assert.ok(
      Number.isFinite(a) && Math.abs(a - b) <= 1e-5 * Math.max(1, Math.abs(b)),
      `${label}: ${a} != ${b}`
    );
};
function begin(name, root, painter) {
  if (process.env.PG_PARITY_VERBOSE) console.error("begin", name);
  const nodes = allNodes(root),
    ids = new Map(nodes.map((n, i) => [n, i]));
  current = { name, root, painter, nodes, ids, snapshots: [] };
  cases.push(current);
  commands.push(`new ${nodes.length}`);
  // Construct first with default properties, then restore preferences after topology.
  for (const n of nodes)
    for (const d of dirs)
      if (n.neighbors().hasChild(d))
        commands.push(
          `connect ${ids.get(n)} ${d} ${ids.get(n.neighbors().nodeAt(d))}`
        );
}
function snapshot(label) {
  if (process.env.PG_PARITY_VERBOSE)
    console.error("snapshot", current.name, label);
  const { nodes, ids, painter } = current;
  for (const n of nodes)
    if (n.neighbors().isRoot()) {
      const job = new CommitLayout(n, painter);
      let rounds = 0;
      while (job.crank()) assert.ok(++rounds < 100000, "TS layout terminated");
    }
  const expected = [];
  for (const n of nodes) {
    const id = ids.get(n),
      size = [];
    n.layout().size(size);
    commands.push(
      `set ${id} ${size[0]} ${size[1]} ${n.scale()} ${n.nodeFit()} ${n
        .siblings()
        .getLayoutPreference()} ${+n.rightToLeft()} ${+(
        n.paintGroups().isPaintGroup() && n.paintGroup().explicit()
      )}`
    );
    for (let d = 0; d < 6; ++d) {
      const edge = n.neighbors().at(d);
      if (!edge) continue;
      const gaps = [false, true].map((v) =>
        n.neighbors().hasChild(d)
          ? painter.getSeparation?.(n, api.getDirectionAxis(d), d, v) ?? 0
          : 0
      );
      commands.push(
        `config ${id} ${d} ${edge.getAlignment()} ${edge.axisOverlap()} ${gaps.join(
          " "
        )}`
      );
    }
    const l = n.layout();
    expected.push([
      "N",
      id,
      n.neighbors().isRoot() ? -1 : ids.get(n.neighbors().parentNode()),
      n.neighbors().parentDirection() ?? -1,
      ids.get(n.paintGroup().node()),
      n.neighbors().isRoot()
        ? n.siblings().getLayoutPreference()
        : n.siblings().canonicalLayoutPreference(),
      ...size,
      l.groupX(),
      l.groupY(),
      l.groupScale(),
      l.absoluteX(),
      l.absoluteY(),
      l.absoluteScale(),
    ]);
    for (let d = 2; d < 6; ++d) {
      const e = l.extentsAt(d);
      const bounds = [];
      e.forEach((len, s) => bounds.push(len, s));
      expected.push(["E", id, d, e.offset(), e.numBounds(), ...bounds]);
    }
    for (let d = 0; d < 6; ++d)
      if (n.neighbors().hasChild(d)) {
        const e = n.neighbors().at(d);
        expected.push([
          "C",
          id,
          d,
          ids.get(e.neighbor()),
          e.alignmentOffset(),
          e.separation(),
          e.lineLength(),
          e.xPos(),
          e.yPos(),
        ]);
      }
    const rects = [];
    const rect = (...r) => rects.push(...r);
    api.paintNodeBounds(n, rect);
    api.paintNodeLines(n, 0.5, rect);
    expected.push(["P", id, ...rects]);
    const ring = [];
    let at = n;
    do {
      ring.push(ids.get(at));
      at = at.siblings().next();
      assert.ok(ring.length <= nodes.length);
    } while (at !== n);
    expected.push(["G", id, ...ring]);
  }
  // Independently union the exact rectangles belonging to each group.
  for (const n of nodes)
    if (n.paintGroups().isPaintGroup()) {
      const groupId = ids.get(n),
        rectangles = [];
      for (const entry of expected)
        if (entry[0] === "P" && nodes[entry[1]].paintGroup().node() === n)
          for (let k = 2; k < entry.length; k += 4)
            rectangles.push(entry.slice(k, k + 4));
      const left = Math.min(...rectangles.map(([x, y, w, h]) => x - w / 2)),
        right = Math.max(...rectangles.map(([x, y, w, h]) => x + w / 2));
      const top = Math.min(...rectangles.map(([x, y, w, h]) => y - h / 2)),
        bottom = Math.max(...rectangles.map(([x, y, w, h]) => y + h / 2));
      expected.push([
        "R",
        groupId,
        (left + right) / 2,
        (top + bottom) / 2,
        right - left,
        bottom - top,
      ]);
    }
  current.snapshots.push({ label, expected });
  commands.push(`snapshot ${current.snapshots.length % 2 ? 7 : 1}`);
}
function end() {
  commands.push("end");
}
const fixedPainter = {
  size: (n, out) => {
    const v = n.value();
    out[0] = v?.w ?? 20;
    out[1] = v?.h ?? 12;
  },
  getSeparation: () => 3,
};
const make = (w = 20, h = 12) => new DirectionNode({ w, h });
for (const preset of ["standard", "proportional", "math"]) {
  const base = path.resolve(
    __dirname,
    "../../examples/fixtures/proportion-" + preset
  );
  const loaded = api.deserializeParsegraphDocument(
    JSON.parse(fs.readFileSync(base + ".parsegraph", "utf8"))
  );
  const painter = api.createPresentationPainter(
    loaded.presentation,
    api.createTextMeasurer((s) => Array.from(s).length * 6)
  );
  begin("fixture " + preset, loaded.root, painter);
  snapshot("initial");
  const golden = JSON.parse(fs.readFileSync(base + ".geometry.json", "utf8"));
  for (const n of current.nodes) {
    const size = [];
    n.layout().size(size);
    const g = golden[n.id()];
    for (const [a, b] of [
      [n.layout().absoluteX(), g.x],
      [n.layout().absoluteY(), g.y],
      [size[0], g.width],
      [size[1], g.height],
    ])
      assert.ok(Math.abs(a - b) <= 1e-5);
  }
  snapshot("clean repeated");
  end();
}
for (const [moduleName, fn, args] of [
  ["primes", "buildPrimesDocument", [40]],
  ["ulam", "buildUlamDocument", [60]],
  ["rainbow", "buildRainbowDocument", [6, false]],
  ["rainbow", "buildRainbowDocument", [6, true]],
  ["memory-piers", "buildMemoryPiersDocument", [5, 42]],
]) {
  const document = require("../../examples/generators/" + moduleName)[fn](
    ...args
  );
  const loaded = api.deserializeParsegraphDocument(document);
  begin(
    moduleName + " " + args,
    loaded.root,
    api.createPresentationPainter(
      loaded.presentation,
      api.createTextMeasurer((s) => Array.from(s).length * 6)
    )
  );
  snapshot("initial");
  end();
}
let seed = 0x3b9ac7;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (
  let scenario = 0;
  scenario < Number(process.env.PG_SCENARIOS ?? 100);
  ++scenario
) {
  const root = make(12, 8),
    nodes = [root];
  for (let i = 1; i < 20 + (scenario % 20); ++i) {
    let p, d;
    do {
      p = nodes[random() % nodes.length];
      d = dirs[random() % dirs.length];
    } while (p.neighbors().hasNode(d));
    const n = make(4 + (random() % 24), 4 + (random() % 18));
    p.connect(d, n);
    nodes.push(n);
  }
  for (const n of nodes) {
    n.setNodeFit(scenario % 2 ? Fit.EXACT : Fit.LOOSE);
    n.setScale([0.5, 1, 2][random() % 3]);
    n.setRightToLeft(!!(random() % 2));
    n.siblings().setLayoutPreference(
      n.neighbors().isRoot()
        ? [P.HORIZONTAL, P.VERTICAL][random() % 2]
        : [P.HORIZONTAL, P.VERTICAL, P.PARENT, P.PERPENDICULAR][random() % 4]
    );
    if (random() % 5 === 0) n.paintGroups().crease();
    for (const d of dirs)
      if (n.neighbors().hasChild(d)) {
        n.neighbors().align(
          d,
          d === 0
            ? [A.INWARD_HORIZONTAL, A.INWARD_VERTICAL][random() % 2]
            : [A.NONE, A.NEGATIVE, A.CENTER, A.POSITIVE][random() % 4]
        );
        n.neighbors().setAxisOverlap(
          d,
          [O.ALLOWED, O.PREVENTED, O.DEFAULT][random() % 3]
        );
      }
  }
  begin("random " + scenario, root, fixedPainter);
  snapshot("initial");
  const target = nodes[1 + (random() % (nodes.length - 1))];
  target.setValue({ w: 34, h: 17 });
  snapshot("resize");
  target.paintGroups().isPaintGroup()
    ? target.paintGroups().uncrease()
    : target.paintGroups().crease();
  snapshot("toggle group");
  target.setScale(0.75);
  snapshot("scale");
  const oldParent = target.neighbors().parentNode(),
    oldDirection = api.reverseDirection(target.neighbors().parentDirection());
  commands.push(`disconnect ${current.ids.get(oldParent)} ${oldDirection}`);
  target.disconnect();
  snapshot("detach subtree");
  commands.push(
    `connect ${current.ids.get(oldParent)} ${oldDirection} ${current.ids.get(
      target
    )}`
  );
  oldParent.connect(oldDirection, target);
  snapshot("reattach subtree");
  end();
}
const run = spawnSync(process.argv[2], {
  input: commands.join("\n") + "\n",
  encoding: "utf8",
  maxBuffer: 128 * 1024 * 1024,
});
if (process.env.PG_PARITY_DUMP) {
  fs.writeFileSync(process.env.PG_PARITY_DUMP, commands.join("\n") + "\n");
  fs.writeFileSync(
    process.env.PG_PARITY_DUMP + ".expected.json",
    JSON.stringify(
      cases.map((c) => ({ name: c.name, snapshots: c.snapshots })),
      null,
      2
    )
  );
  fs.writeFileSync(process.env.PG_PARITY_DUMP + ".actual.txt", run.stdout);
}
assert.ifError(run.error);
assert.equal(run.status, 0, run.stderr);
const lines = run.stdout.trim().split("\n");
let lineIndex = 0,
  totalNodes = 0,
  totalSnapshots = 0;
for (const c of cases)
  for (const s of c.snapshots) {
    assert.equal(
      lines[lineIndex++],
      `S ${c.nodes.length}`,
      c.name + " " + s.label
    );
    for (const expected of s.expected) {
      const raw = lines[lineIndex++];
      assert.ok(raw, "missing output");
      const actual = raw.split(/\s+/);
      assert.equal(actual[0], expected[0]);
      assert.equal(
        actual.length,
        expected.length,
        c.name + " " + s.label + " " + raw + " expected " + expected.join(" ")
      );
      for (let k = 1; k < actual.length; ++k)
        near(
          Number(actual[k]),
          expected[k],
          c.name +
            " " +
            s.label +
            " " +
            expected.slice(0, 3).join(" ") +
            " field " +
            k
        );
    }
    const metrics = lines[lineIndex++].split(" ");
    assert.equal(metrics[0], "M");
    if (s.label === "clean repeated")
      assert.deepEqual(metrics.slice(1, 4).map(Number), [0, 0, 0]);
    totalNodes += c.nodes.length;
    ++totalSnapshots;
  }
assert.equal(lineIndex, lines.length);
console.log(
  `${cases.length} graph scenarios, ${totalSnapshots} snapshots, ${totalNodes} node snapshots: all extents, edges, sibling rings, group/absolute transforms and paint rectangles match TypeScript; three geometry goldens pass.`
);
