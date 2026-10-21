import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  Direction,
  DirectionCaret,
  DirectionNode,
  turnRight,
  createPresentation,
  serializeParsegraph,
  serializeParsegraphDocument,
} from "../../src";

function checkCount(count: number) {
  if (!Number.isInteger(count) || count < 2 || count > 200) {
    throw new Error("Count must be an integer between 2 and 200.");
  }
}

/** Port of showUlam: two clockwise runs of each descending length. */
export function buildUlamGraph(count = 35): DirectionNode<string> {
  checkCount(count);
  const caret = new DirectionCaret<string>("");
  caret.node().setId("ulam-root");
  caret.fitExact();
  let direction = Direction.FORWARD;
  let label = count * (count - 1);
  for (let length = count - 1; length >= 1; --length) {
    for (let run = 0; run < 2; ++run) {
      direction = turnRight(direction);
      for (let step = 0; step < length; ++step) {
        caret.spawnMove(direction, String(label)).setId(`ulam-${label--}`);
        if (step === 0) caret.crease();
      }
    }
  }
  return caret.root();
}

/** Square cells, zero minimum gaps, and block/slot roles for primes/composites. */
export function buildUlamDocument(count = 35) {
  const root = buildUlamGraph(count);
  const maximum = count * (count - 1);
  const prime = new Uint8Array(maximum + 1).fill(1);
  prime[0] = prime[1] = 0;
  for (let factor = 2; factor * factor <= maximum; ++factor) {
    if (!prime[factor]) continue;
    for (
      let multiple = factor * factor;
      multiple <= maximum;
      multiple += factor
    ) {
      prime[multiple] = 0;
    }
  }
  const presentation = createPresentation("math");
  // Leave room for the longest number; very wide fonts may still enlarge cells.
  const side = (String(maximum).length + 2) * presentation.text.fontSize;
  for (const style of Object.values(presentation.styles)) {
    style.minWidth = style.minHeight = side;
  }
  root.paintGroup().forEach((group) =>
    group.siblings().forEach((node) => {
      presentation.nodeStyles[String(node.id())] =
        node === root || prime[Number(node.value())] ? "block" : "slot";
    })
  );
  return serializeParsegraphDocument(root, { presentation });
}

function main(args: string[]) {
  let count = 35;
  let format = "v1";
  let output: string | undefined;
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: ulam.ts [--count 2..200] [--format v0|v1] [--output FILE]\nDefaults: count 35, v1 math presentation, JSON on stdout."
      );
      return;
    }
    if (!["--count", "--format", "--output"].includes(arg))
      throw new Error(`Unknown argument: ${arg}`);
    const value = args[++i];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Missing value for ${arg}`);
    if (arg === "--count") count = Number(value);
    else if (arg === "--output") output = value;
    else {
      if (value !== "v0" && value !== "v1")
        throw new Error("Format must be v0 or v1");
      format = value;
    }
  }
  const data =
    format === "v1"
      ? buildUlamDocument(count)
      : serializeParsegraph(buildUlamGraph(count));
  const json = JSON.stringify(data, null, 2) + "\n";
  if (output && output !== "-") {
    const filename = resolve(output);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, json, "utf8");
    console.error(`Wrote ${filename} (${count * (count - 1) + 1} nodes).`);
  } else process.stdout.write(json);
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
