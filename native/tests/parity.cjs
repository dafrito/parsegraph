// Compare against live TS sources, not a possibly stale dist/ bundle.
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
require("ts-node").register({
  project: path.resolve(__dirname, "../../examples/tsconfig.json"),
  transpileOnly: true,
});
const { Extent } = require("../../src/DirectionNode/Layout/Extent/Extent");

let seed = 0x183ec7;
const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
const make = (pairs) => {
  const e = new Extent();
  for (const [length, size] of pairs) e.appendLS(length, size);
  return e;
};
const pairs = (e) => Array.from({ length: e.numBounds() }, (_, i) => [e.boundLengthAt(i), e.boundSizeAt(i)]);
const cases = [];
for (let n = 0; n < 600; ++n) {
  const generate = () => Array.from({ length: random() % 15 }, () => [
    (random() % 40 + 1) / 4,
    random() % 5 === 0 ? NaN : (random() % 100 - 20) / 4,
  ]);
  cases.push({ a: make(generate()), b: make(generate()),
    displacement: (random() % 100 - 50) / 4,
    adjustment: (random() % 40 - 20) / 4,
    scale: [0.25, 0.5, 1, 2, 4][random() % 5], overlap: Boolean(random() % 2) });
}
// Explicit endpoints, empty extents, gaps, float32 rounding and old test cases.
for (const displacement of [-100, -10, 0, 10, 100]) {
  for (const overlap of [true, false]) {
    cases.push({a: make([[50, 25]]), b: make([[10, NaN], [30, 5]]),
      displacement, adjustment: 30, scale: 1, overlap});
    cases.push({a: make([[0.1, 0.3], [0.2, 0.7]]), b: make([[0.3, -0.4]]),
      displacement, adjustment: 0.1, scale: 0.3, overlap});
  }
}
const number = (x) => Number.isNaN(x) ? "nan" : String(x);
const input = cases.map(({a,b,displacement,adjustment,scale,overlap}) =>
  [a.numBounds(), b.numBounds(), displacement, adjustment, scale, +overlap,
    ...pairs(a).flat(), ...pairs(b).flat()].map(number).join(" ")).join("\n") + "\n";
const run = spawnSync(process.argv[2], {input, encoding:"utf8", maxBuffer:16 * 1024 * 1024});
assert.ifError(run.error);
assert.equal(run.status, 0, run.stderr);
const lines = run.stdout.trim().split("\n");
assert.equal(lines.length, cases.length);
const near = (actual, expected, label) => {
  if (Number.isNaN(expected)) assert.ok(Number.isNaN(actual), label);
  else assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-6 * Math.max(1, Math.abs(expected)),
    `${label}: ${actual} != ${expected}`);
};
// Independent interval oracle: evaluate each open span between all endpoints.
// Unlike the native two-pointer loop, this scans the complete piecewise inputs.
function separationOracle(a, b, displacement, overlap, scale) {
  const spans = (e, origin, factor) => {
    let pos = origin;
    return pairs(e).map(([length, size]) => {
      const start = pos;
      pos += length * factor;
      return {start, end:pos, size:size * factor};
    });
  };
  const left = spans(a, 0, 1), right = spans(b, displacement, scale);
  const endpoints = [...new Set([...left, ...right].flatMap(s => [s.start, s.end]))].sort((a,b)=>a-b);
  let result = 0;
  for (let i = 1; i < endpoints.length; ++i) {
    const midpoint = (endpoints[i-1] + endpoints[i]) / 2;
    const x = left.find(s=>s.start < midpoint && midpoint < s.end)?.size ?? NaN;
    const y = right.find(s=>s.start < midpoint && midpoint < s.end)?.size ?? NaN;
    if (!Number.isNaN(x) && !Number.isNaN(y)) result = Math.max(result, x+y);
    else if (!overlap) result = Math.max(result, Number.isNaN(x) ? 0 : x, Number.isNaN(y) ? 0 : y);
  }
  return result;
}
let correctedSeparations = 0;
for (let index = 0; index < cases.length; ++index) {
  const {a,b,displacement,adjustment,scale,overlap} = cases[index];
  const values = lines[index].split(/\s+/).map(Number);
  const rawSeparation = a.separation(b, displacement, overlap, scale);
  // Known TS defect: the non-overlap path omits the remaining base tail.
  const separation = separationOracle(a,b,displacement,overlap,scale);
  if (Math.abs(separation - rawSeparation) > 1e-6) {
    assert.equal(overlap, false, "unexpected TS separation divergence");
    assert.ok(rawSeparation < separation, "unexpected TS separation divergence");
    ++correctedSeparations;
  }
  near(values.shift(), separation, `case ${index} separation`);
  const combined = a.combinedExtent(b, displacement, adjustment, scale);
  assert.equal(values.shift(), combined.numBounds(), `case ${index} combined count`);
  for (const [length,size] of pairs(combined)) {
    near(values.shift(), length, `case ${index} length`);
    near(values.shift(), size, `case ${index} size`);
  }
  for (const v of combined.boundingValues()) near(values.shift(), v, `case ${index} bounding values`);
  const simplified = a.clone();
  simplified.combineExtentAndSimplify(b, displacement, adjustment, scale, []);
  assert.equal(values.shift(), simplified.numBounds(), `case ${index} simplified count`);
  for (const [length,size] of pairs(simplified)) {
    near(values.shift(), length, `case ${index} simplified length`);
    near(values.shift(), size, `case ${index} simplified size`);
  }
  assert.equal(values.length, 0);
}

// Minimal reproductions pin the TS defects rather than silently claiming full
// parity. If TS is repaired, update these assertions and the documented ledger.
const prepended = new Extent();
prepended.prependLS(1, 10); prepended.prependLS(2, 20); prepended.prependLS(3, 30);
assert.notDeepEqual(pairs(prepended), [[3,30],[2,20],[1,10]], "TS prepend defect was repaired: update ledger");
const source = make([[1,10]]), dest = new Extent();
dest.copyFrom(source);
source.appendLS(1,99);
assert.equal(dest.boundSizeAt(0), 99, "TS copyFrom alias defect was repaired: update ledger");
assert.equal(make([[1,-10]]).equals(make([[1,10]])), true, "TS signed equality defect was repaired: update ledger");
assert.equal(make([[1,1]]).equals(make([[1,1.01]]), 0.1), false,
  "TS size tolerance defect was repaired: update ledger");
console.log(`${cases.length} TS comparisons passed; ${correctedSeparations} known separation-tail differences asserted.`);
console.log("Confirmed TS regressions: prepend/growth, copyFrom aliasing, signed equality/size tolerance.");
