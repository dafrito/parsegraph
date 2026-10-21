const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("ts-node").register({
  project: path.resolve(__dirname, "../../examples/tsconfig.json"),
  transpileOnly: true,
});
const api = require("../../src");
const { buildPrimesDocument } = require("../../examples/generators/primes");
let nodesCompared = 0;
for (const count of [1, 2, 3, 10, 30, 100]) {
  const document = buildPrimesDocument(count);
  const loaded = api.deserializeParsegraphDocument(document);
  const painter = api.createPresentationPainter(
    loaded.presentation,
    api.createTextMeasurer((text) => Array.from(text).length * 6)
  );
  const job = new api.CommitLayout(loaded.root, painter);
  while (job.crank()) {}
  const actual = spawnSync(process.argv[2], [String(count)], {
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  assert.equal(actual.status, 0, actual.stderr || actual.error?.message);
  const rows = actual.stdout.trim().split("\n").map(JSON.parse);
  const byId = new Map(rows.map((row) => [row[0], row]));
  const stack = [loaded.root];
  while (stack.length) {
    const node = stack.pop();
    const layout = node.layout();
    const expected = [
      node.id(),
      node.value(),
      node.neighbors().isRoot() ? "" : node.neighbors().parentNode().id(),
      node.neighbors().parentDirection() ?? -1,
      node.paintGroup().node().id(),
      node.neighbors().isRoot()
        ? node.siblings().getLayoutPreference()
        : node.siblings().canonicalLayoutPreference(),
      +node.paintGroup().explicit() * +node.paintGroups().isPaintGroup(),
      layout.groupX(), layout.groupY(), layout.groupScale(),
      layout.absoluteX(), layout.absoluteY(), layout.absoluteScale(),
    ];
    const row = byId.get(node.id());
    assert.ok(row, `native graph missing ${node.id()}`);
    assert.deepEqual(row.slice(0, 7), expected.slice(0, 7));
    for (let i = 7; i < expected.length; ++i)
      assert.ok(Math.abs(row[i] - expected[i]) < 1e-5,
        `${node.id()} transform[${i}]: native ${row[i]} != TS ${expected[i]}`);
    byId.delete(node.id());
    ++nodesCompared;
    for (const direction of [0, 2, 3, 4, 5])
      if (node.neighbors().hasChild(direction)) stack.push(node.neighbors().nodeAt(direction));
  }
  assert.equal(byId.size, 0, "unexpected native nodes");
}
console.log(`primes: native generator matches TypeScript topology, text, paint groups and geometry for ${nodesCompared} nodes`);
