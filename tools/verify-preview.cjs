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
    const endpoints = nodes.filter((node) => /^\d+$/.test(String(node.value())));
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
console.log(
  `Package ${metadata.version}: CommonJS/UMD, v1 APIs, v0 import, capability/metadata round trips, appearance, and all three geometry fixtures pass.`
);
