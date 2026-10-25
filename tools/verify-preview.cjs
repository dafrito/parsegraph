const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
// The archive verifier copies this into a temporary consumer with an installed
// node_modules/parsegraph. The optional directory preserves the preview tool's
// existing standalone interface.
const directory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.dirname(require.resolve("parsegraph/package.json"));
const api = process.argv[2] ? require(directory) : require("parsegraph");
const metadata = require(path.join(directory, "package.json"));
const browser = {};
vm.runInNewContext(
  fs.readFileSync(path.join(directory, metadata.main), "utf8"),
  browser
);
assert.equal(
  typeof browser.parsegraph.DirectionNode,
  "function",
  "UMD browser global"
);
assert.equal(typeof browser.parsegraph.serializeParsegraphDocument, "function");
for (const name of [
  "DirectionNode",
  "CommitLayout",
  "serializeParsegraphDocument",
  "deserializeParsegraphDocument",
  "validateParsegraphDocument",
  "createPresentation",
  "createTextMeasurer",
  "createPresentationPainter",
  "resolveNodeAppearance",
])
  assert.equal(typeof api[name], "function", `Missing export ${name}`);
assert.ok(fs.existsSync(path.join(directory, metadata.types)));
assert.ok(fs.existsSync(path.join(directory, "dist/src/document/index.d.ts")));
for (const preset of ["standard", "proportional", "math"]) {
  const base = path.join(directory, "examples/fixtures/proportion-" + preset);
  const document = JSON.parse(fs.readFileSync(base + ".parsegraph", "utf8"));
  document.capabilities["future/test/1"] = { preserve: [null, 42, "value"] };
  document.metadata = {
    freeform: { selectedNode: document.root },
    custom: { note: "preserve" },
  };
  const loaded = api.deserializeParsegraphDocument(document);
  const saved = api.serializeParsegraphDocument(loaded.root, loaded);
  assert.deepEqual(saved.capabilities, document.capabilities);
  assert.deepEqual(saved.metadata, document.metadata);
  const painter = api.createPresentationPainter(
    loaded.presentation,
    api.createTextMeasurer((line) => Array.from(line).length * 6)
  );
  const layout = new api.CommitLayout(loaded.root, painter);
  while (layout.crank());
  const expected = JSON.parse(fs.readFileSync(base + ".geometry.json", "utf8"));
  const nodes = [];
  loaded.root
    .paintGroup()
    .forEach((group) => group.siblings().forEach((node) => nodes.push(node)));
  assert.equal(nodes.length, 25);
  for (const node of nodes) {
    const size = [0, 0];
    node.layout().size(size);
    const actual = {
      x: node.layout().absoluteX(),
      y: node.layout().absoluteY(),
      width: size[0],
      height: size[1],
    };
    for (const key of Object.keys(actual))
      assert.ok(
        Math.abs(actual[key] - expected[node.id()][key]) <= 1e-5,
        `${preset} ${node.id()} ${key}`
      );
  }
  if (preset === "proportional") {
    const endpoints = nodes.filter((node) =>
      /^\d+$/.test(String(node.value()))
    );
    assert.ok(
      endpoints.length > 1,
      "Proportional fixture must have numbered endpoints"
    );
    for (const node of endpoints)
      assert.ok(
        Math.abs(
          node.layout().absoluteY() - endpoints[0].layout().absoluteY()
        ) <= 1e-5,
        "Proportional endpoints must share a baseline"
      );
  }
}
const legacy = api.serializeParsegraph(new api.DirectionNode("legacy"));
const legacyState = api.deserializeParsegraphDocument(legacy);
assert.equal(legacyState.version, 0);
assert.equal(legacyState.root.value(), "legacy");
const colored = JSON.parse(
  fs.readFileSync(
    path.join(directory, "examples/fixtures/appearance-colors.parsegraph"),
    "utf8"
  )
);
const coloredState = api.deserializeParsegraphDocument(colored);
assert.deepEqual(coloredState.ignoredCapabilities, []);
assert.equal(
  api.resolveNodeAppearance(coloredState.appearance, "child").backgroundAlpha,
  0.5
);
assert.equal(
  api.resolveNodeAppearance(coloredState.appearance, "transparent")
    .backgroundAlpha,
  0
);
assert.deepEqual(
  api.serializeParsegraphDocument(coloredState.root, coloredState).capabilities,
  colored.capabilities
);
// Run the same public-API contract against the installed CommonJS bundle and
// the browser UMD global. No source imports or repository helpers are available.
function verifyFocusAndSeparation(lib) {
  const {
    DirectionNode,
    DirectionCaret,
    Direction: D,
    Fit,
    PreferredAxis,
    CommitLayout,
  } = lib;
  const plain = (value) => JSON.parse(JSON.stringify(value));
  const nodes = [
    [10, 10],
    [10, 100],
    [100, 10],
    [10, 10],
    [10, 20],
    [100, 10],
  ].map((size, i) => {
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
  down.paintGroups().crease();
  const caret = new DirectionCaret(root);
  caret.pull(D.DOWNWARD);
  const commit = (node) => {
    const job = new CommitLayout(node, {
      size: (n, out) => {
        out[0] = n.value()[0];
        out[1] = n.value()[1];
      },
    });
    let steps = 0;
    while (job.crank()) assert.ok(++steps < 10000, "Installed layout stalled");
  };
  const positions = () =>
    nodes.map((n) => [n.layout().absoluteX(), n.layout().absoluteY()]);
  commit(root);
  const exact = positions();
  caret.focus("d", "f");
  down.setFocus(); // Explicit body-only intent must survive serialization.
  assert.deepEqual(plain(root.focusDirections()), [D.DOWNWARD, D.FORWARD]);
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
  assert.deepEqual(plain(root.layout().focusBounds()), {
    left: Math.min(...rects.map((r) => r[0])),
    top: Math.min(...rects.map((r) => r[1])),
    right: Math.max(...rects.map((r) => r[2])),
    bottom: Math.max(...rects.map((r) => r[3])),
  });
  assert.deepEqual(
    plain(root.layout().boundsForDirections(D.DOWNWARD, D.FORWARD)),
    plain(root.layout().focusBounds())
  );
  assert.deepEqual(positions(), exact, "Focus must not change geometry");
  caret.loosen();
  assert.equal(root.nodeFit(), Fit.EXACT);
  assert.equal(root.separationFit(D.FORWARD), Fit.LOOSE);
  assert.equal(root.separationFit(D.BACKWARD), Fit.LOOSE);
  assert.equal(root.separationFit(D.DOWNWARD), Fit.EXACT);
  assert.throws(() => root.layout().focusBounds(), /completed layout/);
  commit(root);
  assert.ok(
    next.layout().absoluteX() > exact[3][0],
    "Loose separation must reserve the content envelope"
  );
  const document = lib.serializeParsegraphDocument(root);
  assert.deepEqual(plain(document.capabilities["focus/1"]), {
    nodeDirections: { 0: ["downward", "forward"], 1: [] },
  });
  assert.deepEqual(plain(document.capabilities["separation/1"]), {
    nodeDirections: { 0: ["forward", "backward"] },
  });
  lib.validateParsegraphDocument(document);
  document.nodes.reverse();
  const loaded = lib.deserializeParsegraphDocument(document);
  assert.deepEqual(plain(loaded.ignoredCapabilities), []);
  commit(loaded.root);
  assert.deepEqual(
    plain(loaded.root.layout().focusBounds()),
    plain(root.layout().focusBounds())
  );
  assert.deepEqual(
    plain(lib.serializeParsegraphDocument(loaded.root, loaded).capabilities),
    plain(document.capabilities)
  );
  const restoredCaret = new DirectionCaret(loaded.root);
  restoredCaret.tighten();
  restoredCaret.clearFocus();
  assert.equal(loaded.root.focusDirections(), undefined);
  assert.equal(loaded.root.separationFit(D.FORWARD), Fit.EXACT);
  const cleared = lib.serializeParsegraphDocument(loaded.root, loaded);
  assert.deepEqual(plain(cleared.capabilities["focus/1"]), {
    nodeDirections: { 1: [] },
  });
  assert.deepEqual(plain(cleared.capabilities["separation/1"]), {
    nodeDirections: {},
  });
  root.setSeparationFit(D.FORWARD, Fit.EXACT);
  caret.tighten();
  commit(root);
  assert.deepEqual(positions(), exact, "Tighten must restore exact geometry");
  for (const capability of ["focus/1", "separation/1"]) {
    const invalid = plain(document);
    invalid.capabilities[capability] = { nodeDirections: { 0: ["outward"] } };
    assert.throws(() => lib.validateParsegraphDocument(invalid));
  }
  // The released bundle must contain the inward-root pull correction too.
  const host = new DirectionNode([400, 400]);
  host.connect(D.INWARD, root);
  caret.pull(D.DOWNWARD);
  caret.loosen();
  assert.equal(root.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);
  assert.equal(root.siblings().layoutOrder()[1], D.DOWNWARD);
  assert.equal(root.separationFit(D.FORWARD), Fit.LOOSE);
  commit(host);
}
verifyFocusAndSeparation(api);
verifyFocusAndSeparation(browser.parsegraph);
console.log(
  `Package ${metadata.version}: CommonJS/UMD, v1 APIs, v0 import, capability/metadata round trips, appearance, focus/separation behavior and round trips, and all three geometry fixtures pass.`
);
