const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const directory = path.resolve(process.argv[2]);
const api = require(directory);
const metadata = require(path.join(directory, "package.json"));
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
}
const legacy = api.serializeParsegraph(new api.DirectionNode("legacy"));
assert.equal(api.deserializeParsegraphDocument(legacy).version, 0);
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
  `Package ${metadata.version}: v1 APIs, v0 import, capability/metadata round trips, appearance, and all three geometry fixtures pass.`
);
