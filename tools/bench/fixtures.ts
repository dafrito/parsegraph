import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { DirectionNode, Direction as D } from "../../src";
import { buildProportionGraph } from "../../examples/generators/proportion";
import { buildMemoryPiersGraph } from "../../examples/generators/memory-piers";
import { buildRainbowGraph } from "../../examples/generators/rainbow";

// Shared input, NOT a .parsegraph format: parent, direction, width, height,
// scale, explicit crease, preferred axis, parent-edge alignment and overlap.
// Both runtimes reconstruct these records in precisely the same order.
export function fixture(shape: string, budget: number, seed: number) {
  if (!Number.isInteger(budget) || budget < 16 || budget > 4096)
    throw new Error("Node budget must be 16..4096");
  let root: DirectionNode;
  let parameter = budget;
  if (["deep", "balanced", "comb", "groups"].includes(shape)) {
    const nodes = Array.from(
      { length: budget },
      () => new DirectionNode([24, 16])
    );
    root = nodes[0];
    if (shape === "comb") {
      const spine = Math.ceil(budget / 2);
      for (let i = 1; i < spine; i++) nodes[i - 1].connect(D.FORWARD, nodes[i]);
      for (let i = spine; i < budget; i++) {
        nodes[i].setValue([12, 16 + (budget - i) * 2]);
        nodes[i - spine].connect(D.UPWARD, nodes[i]);
      }
    } else if (shape === "groups") {
      nodes[0].connect(D.FORWARD, nodes[1]);
      nodes[0].connect(D.DOWNWARD, nodes[2]);
      nodes[2].connect(D.FORWARD, nodes[3]);
      nodes[2].paintGroups().crease();
      nodes[3].paintGroups().crease();
      for (let i = 4; i < budget; i++) {
        const j = i - 3;
        nodes[3 + Math.floor((j - 1) / 2)].connect(
          j % 2 ? D.FORWARD : D.DOWNWARD,
          nodes[i]
        );
      }
    } else {
      for (let i = 1; i < budget; i++)
        nodes[shape === "deep" ? i - 1 : Math.floor((i - 1) / 2)].connect(
          shape === "deep" || i % 2 ? D.FORWARD : D.DOWNWARD,
          nodes[i]
        );
    }
  } else {
    const builders = {
      proportion: (n: number) => buildProportionGraph(n),
      "memory-piers": (n: number) => buildMemoryPiersGraph(n, seed),
      rainbow: (n: number) => buildRainbowGraph(n),
    };
    if (!(shape in builders)) throw new Error(`Unknown shape: ${shape}`);
    parameter =
      shape === "rainbow"
        ? Math.min(15, Math.floor(Math.cbrt(budget)))
        : Math.min(45, Math.floor(Math.sqrt(budget)));
    // Bounds are checked before generation; never build the full default demo.
    do {
      root = builders[shape as keyof typeof builders](parameter);
      if (flatten(root).length <= budget) break;
      parameter--;
    } while (parameter >= (shape === "rainbow" ? 2 : 1));
  }
  const nodes = flatten(root!);
  if (nodes.length > budget)
    throw new Error("Generated fixture exceeds node budget");
  const ids = new Map(nodes.map((n, i) => [n, i]));
  const records = nodes.map((n) => {
    const parent = n.neighbors().isRoot() ? null : n.neighbors().parentNode();
    const edge = parent ? n.neighbors().parent() : null;
    const v = n.value();
    // Controlled, precomputed body sizes. Demo topology is real; these are not
    // font/renderer timings or a promise to reproduce its original appearance.
    const size = Array.isArray(v)
      ? v
      : v === undefined
      ? [8, 8]
      : [24 + String(v).length * 8, 16];
    return [
      parent ? ids.get(parent)! : -1,
      edge ? edge.direction() : -1,
      ...size,
      n.scale(),
      +(n.paintGroups().isPaintGroup() && n.paintGroup().explicit()),
      n.siblings().getLayoutPreference(),
      edge?.getAlignment() ?? 0,
      edge?.axisOverlap() ?? 0,
    ];
  });
  const text = `${nodes.length}\n${records
    .map((r) => r.join(" "))
    .join("\n")}\n`;
  return {
    text,
    metadata: {
      shape,
      budget,
      parameter,
      nodes: nodes.length,
      seed,
      sha256: createHash("sha256").update(text).digest("hex"),
      groups: 1 + records.slice(1).filter((r) => r[5]).length,
      gap: 4,
      measurement: "precomputed synthetic body sizes; no text engine",
    },
  };
}

function flatten(root: DirectionNode): DirectionNode[] {
  const nodes: DirectionNode[] = [],
    stack = [root];
  while (stack.length) {
    const n = stack.pop()!;
    nodes.push(n);
    for (const d of [D.BACKWARD, D.FORWARD, D.UPWARD, D.DOWNWARD, D.INWARD])
      if (n.neighbors().hasChild(d)) stack.push(n.neighbors().nodeAt(d));
  }
  return nodes;
}

if (require.main === module) {
  const [shape, count, seed, directory] = process.argv.slice(2);
  const { text, metadata } = fixture(shape, Number(count), Number(seed));
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, "fixture.txt"), text);
  writeFileSync(
    join(directory, "fixture.json"),
    JSON.stringify(metadata, null, 2) + "\n"
  );
  console.log(JSON.stringify(metadata));
}
