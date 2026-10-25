const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("ts-node").register({
  project: path.resolve(__dirname, "../../examples/tsconfig.json"),
  transpileOnly: true,
});
const { DirectionNode, Direction: D, CommitLayout } = require("../../src");
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
const layout = new CommitLayout(root, {
  size: (n, out) => {
    out[0] = n.value()[0];
    out[1] = n.value()[1];
  },
  getSeparation: () => 4,
});
let steps = 0;
while (layout.crank()) assert.ok(++steps < 10000);
const result = spawnSync(process.argv[2], ["--json"], {
  encoding: "utf8",
  timeout: 30000,
});
assert.equal(result.status, 0, result.stderr);
const actual = result.stdout.trim().split("\n").map(JSON.parse);
let checked = 0;
for (let i = 0; i < nodes.length; ++i)
  for (let mask = 0; mask < 64; ++mask) {
    const directions = Array.from({ length: 6 }, (_, d) => d).filter(
      (d) => mask & (1 << d)
    );
    const row = actual.find((r) => r.node === i && r.mask === mask);
    if (
      directions.includes(D.OUTWARD) ||
      (!nodes[i].neighbors().isRoot() &&
        directions.includes(nodes[i].neighbors().parentDirection()))
    ) {
      assert.equal(row, undefined);
      assert.throws(() => nodes[i].layout().boundsForDirections(...directions));
      continue;
    }
    assert.ok(row, `missing ${i}/${mask}`);
    const b = nodes[i].layout().boundsForDirections(...directions);
    [b.left, b.top, b.right, b.bottom].forEach((v, k) =>
      assert.ok(
        Math.abs(v - row.bounds[k]) < 1e-6,
        `${i}/${mask} field ${k}: ${v} != ${row.bounds[k]}`
      )
    );
    ++checked;
  }
assert.equal(actual.length, checked);
console.log(`${checked} focus selections agree between C and TypeScript`);
