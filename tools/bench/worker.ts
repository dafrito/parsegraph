import { readFileSync } from "node:fs";
import { CommitLayout, DirectionNode, Fit } from "../../src";
import { drawing } from "./drawing";

const [file, fitName, warmupText, mode] = process.argv.slice(2);
const raw = readFileSync(file, "utf8").trim().split(/\s+/).map(Number);
const count = raw.shift()!;
if (
  !Number.isInteger(count) ||
  count < 1 ||
  count > 4096 ||
  raw.length !== count * 9 ||
  raw.some((v) => !Number.isFinite(v)) ||
  !["exact", "loose"].includes(fitName)
)
  throw new Error("Invalid benchmark fixture/fit");
const records = Array.from({ length: count }, (_, i) =>
  raw.slice(i * 9, i * 9 + 9)
);
const warmups = Number(warmupText);
if (!Number.isInteger(warmups) || warmups < 0 || warmups > 10)
  throw new Error("Invalid warmup count");
const verify = mode === "verify";
const clock = () => process.hrtime.bigint();
const elapsed = (start: bigint) => Number(clock() - start) / 1e6;

function trial(emit: boolean) {
  let measured = 0;
  const start = clock();
  const nodes = records.map((r) => new DirectionNode([r[2], r[3]]));
  for (let i = 1; i < count; i++) {
    const r = records[i];
    if (r[0] < 0 || r[0] >= i) throw new Error("Parents must precede children");
    nodes[r[0]].connect(r[1], nodes[i]);
  }
  for (let i = 0; i < count; i++) {
    const r = records[i],
      n = nodes[i];
    n.setNodeFit(fitName === "exact" ? Fit.EXACT : Fit.LOOSE);
    n.setScale(r[4]);
    n.siblings().setLayoutPreference(r[6]);
    if (r[5]) n.paintGroups().crease();
    if (i) {
      nodes[r[0]].neighbors().align(r[1], r[7]);
      nodes[r[0]].neighbors().setAxisOverlap(r[1], r[8]);
    }
  }
  const layout = new CommitLayout(nodes[0], {
    size: (node, size) => {
      measured++;
      size[0] = node.value()[0];
      size[1] = node.value()[1];
    },
    getSeparation: () => 4,
  });
  const construct = elapsed(start);
  if (mode === "drawing") {
    while (layout.crank()) {
      /* Illustration only; no benchmark samples. */
    }
    if (emit) console.log(JSON.stringify(drawing(nodes)));
    return;
  }
  function memory() {
    let bounds = 0,
      capacity = 0;
    for (const n of nodes)
      for (let d = 2; d < 6; d++) {
        const e = n.layout().extentsAt(d);
        bounds += e.numBounds();
        capacity += e.boundCapacity() * 8;
      }
    const m = process.memoryUsage();
    return {
      extent_bounds: bounds,
      extent_capacity_bytes: capacity,
      node_struct_bytes: null,
      rss_bytes: m.rss,
      peak_rss_bytes: process.resourceUsage().maxRSS * 1024,
      heap_used_bytes: m.heapUsed,
      external_bytes: m.external,
      array_buffer_bytes: m.arrayBuffers,
    };
  }
  function output(
    stage: string,
    ms: number,
    iterations: number,
    checksum: number | null = null
  ) {
    if (emit)
      console.log(
        JSON.stringify({
          type: "sample",
          stage,
          elapsed_ms: ms,
          iterations,
          nodes_measured: measured,
          work_units: null,
          checksum,
          memory: memory(),
        })
      );
  }
  output("construct", construct, 1);
  function transforms() {
    let sum = 0;
    for (const n of nodes) {
      const l = n.layout();
      sum +=
        l.groupX() +
        l.groupY() +
        l.groupScale() +
        l.absoluteX() +
        l.absoluteY() +
        l.absoluteScale();
    }
    if (!Number.isFinite(sum)) throw new Error("Nonfinite geometry");
    return sum;
  }
  function snapshot(stage: string) {
    if (emit && verify)
      console.log(
        JSON.stringify({
          type: "geometry",
          stage,
          nodes: nodes.map((n) => {
            const l = n.layout(),
              size: number[] = [];
            l.size(size);
            return [
              l.absoluteX(),
              l.absoluteY(),
              l.absoluteScale(),
              l.groupX(),
              l.groupY(),
              l.groupScale(),
              ...size,
              ...[2, 3, 4, 5].flatMap((d) => [
                l.extentsAt(d).offset(),
                l.extentsAt(d).numBounds(),
              ]),
            ];
          }),
        })
      );
  }
  function run(
    stage: string,
    iterations: number,
    mutation?: (i: number) => void
  ) {
    measured = 0;
    let apiMs = 0,
      placementMs = 0,
      checksum = 0;
    for (let i = 0; i < iterations; i++) {
      let t = clock();
      mutation?.(i);
      while (layout.crank()) {
        /* Public API, including eager placement. */
      }
      apiMs += elapsed(t);
      t = clock();
      checksum = transforms();
      placementMs += elapsed(t);
    }
    output(stage + "/api", apiMs, iterations, checksum);
    output(stage + "/placement", placementMs, iterations, checksum);
    output(stage + "/ready", apiMs + placementMs, iterations, checksum);
    snapshot(stage);
  }
  run("full_layout", 1);
  run("noop", 20);
  run("leaf_resize", 3, () => {
    nodes[count - 1].value()[1]++;
    nodes[count - 1].invalidate();
  });
  run("root_resize", 3, () => {
    nodes[0].value()[1] += 1000;
    nodes[0].invalidate();
  });
  const group = nodes.slice(1).find((n) => n.paintGroups().isPaintGroup());
  if (group) run("group_scale", 4, (i) => group.setScale(i % 2 ? 0.5 : 0.75));
}

for (let i = 0; i < warmups; i++) {
  trial(false);
  global.gc?.();
}
global.gc?.();
trial(true);
