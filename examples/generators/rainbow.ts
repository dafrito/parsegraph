import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Color from "parsegraph-color";
import {
  Appearance,
  DirectionCaret,
  createPresentation,
  serializeParsegraph,
  serializeParsegraphDocument,
} from "../../src";

function buildRainbow(count: number, vertical: boolean) {
  if (!Number.isInteger(count) || count < 2 || count > 30) {
    throw new Error("Count must be an integer between 2 and 30.");
  }
  if (typeof vertical !== "boolean")
    throw new Error("Vertical must be boolean.");
  const appearance: Appearance = {
    // Freeform's effective default node colors, including translucent buds.
    defaults: {
      backgroundColor: "#80ff80",
      backgroundAlpha: 0.1,
      borderColor: "#000000",
      borderAlpha: 0.5,
      textColor: "#000000",
      textAlpha: 1,
      lineColor: "#e6e6e6",
      lineAlpha: 0.8,
    },
    nodeStyles: {},
    pageBackgroundColor: "#383838",
    pageBackgroundAlpha: 1,
  };
  const caret = new DirectionCaret();
  let nextId = 0;
  caret.node().setId(`rainbow-${nextId++}`);
  const spawnMove = (direction: string) => {
    const node = caret.spawnMove(direction);
    node.setId(`rainbow-${nextId++}`);
    return node;
  };
  for (let layer = 0; layer < count; ++layer) {
    spawnMove(vertical ? "d" : "f");
    caret.push();
    if (layer % 8 === 0) caret.crease();
    const hue = (layer / (count - 1)) * 360;
    for (let column = 0; column < count; ++column) {
      spawnMove(vertical ? "f" : "d");
      caret.push();
      const chroma = (column / (count - 1)) * 360;
      const a = Color.fromLCH(0, chroma, hue, 1);
      const b = Color.fromLCH(100, chroma, hue, 1);
      for (let row = 0; row < count; ++row) {
        appearance.nodeStyles[String(caret.node().id())] = {
          backgroundColor: a.interpolate(b, row / (count - 1)).asHex(),
          backgroundAlpha: 1,
        };
        // Keep the original's uncolored trailing node on every row.
        spawnMove(vertical ? "d" : "f");
      }
      caret.pop();
    }
    caret.pop();
  }
  return { root: caret.root(), appearance };
}

/** Port of Freeform's buildRainbow, using the same color-library version. */
export function buildRainbowDocument(count = 20, vertical = false) {
  const { root, appearance } = buildRainbow(count, vertical);
  const presentation = createPresentation();
  // Every node in this builder is a bud; no labels or inferred value styling.
  presentation.defaultStyle = "bud";
  return serializeParsegraphDocument(root, { presentation, appearance });
}

export function buildRainbowGraph(count = 20, vertical = false) {
  return buildRainbow(count, vertical).root;
}

function main(args: string[]) {
  let count = 20;
  let vertical = false;
  let output: string | undefined;
  let format = "v1";
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: rainbow.ts [--count 2..30] [--vertical] [--format v0|v1] [--output FILE]\nDefaults: count 20, horizontal, v1 presentation and appearance, JSON on stdout."
      );
      return;
    }
    if (arg === "--vertical") {
      vertical = true;
      continue;
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
      ? buildRainbowDocument(count, vertical)
      : serializeParsegraph(buildRainbowGraph(count, vertical));
  const json = JSON.stringify(data, null, 2) + "\n";
  if (format === "v0")
    console.error(
      "V0 omits the rainbow colors and presentation; use v1 for this example."
    );
  if (output && output !== "-") {
    const filename = resolve(output);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, json, "utf8");
    console.error(
      `Wrote ${filename} (${count ** 3 + count ** 2 + count + 1} nodes).`
    );
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
