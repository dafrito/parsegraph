import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DirectionCaret,
  DirectionNode,
  serializeParsegraph,
  serializeParsegraphDocument,
  createPresentation,
} from "../../src";

/** Builds the static structure from graph-js's showProportionTest. */
export function buildProportionGraph(count = 30): DirectionNode<string> {
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error("Count must be an integer between 1 and 200.");
  }

  // Freeform renders strings (including empty strings) as blocks and missing
  // values as buds. Graph-js's block/slot styles are not part of the core format.
  const caret = new DirectionCaret<string>("");
  let nextId = 0;
  caret.node().setId(`proportion-${nextId++}`);
  const spawnMove = (direction: string, value?: string) => {
    const node = caret.spawnMove(direction, value);
    node.setId(`proportion-${nextId++}`);
    return node;
  };

  for (let i = 0; i < count; ++i) {
    for (const direction of ["b", "f"]) {
      caret.push();
      spawnMove(direction);
      for (let j = 0; j < count - i - 1; ++j) {
        spawnMove("d");
        if (j === 0) {
          caret.crease();
        }
      }
      spawnMove("d", String(count - i));
      caret.pop();
    }

    caret.pull("d");
    spawnMove("d", "");
  }

  caret.moveTo(caret.root());
  spawnMove("u");
  caret.push();
  spawnMove("b");
  caret.pop();
  spawnMove("f");
  return caret.root();
}

function main(args: string[]) {
  let count = 30;
  let output: string | undefined;
  let format = "v0";
  let preset: "standard" | "proportional" | "math" = "proportional";
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: proportion.ts [--count 1..200] [--output FILE] [--format v0|v1] [--presentation standard|proportional|math]\n" +
          "Defaults: count 30; format v0; proportional presentation for v1; JSON on stdout."
      );
      return;
    }
    if (!["--count", "--output", "--format", "--presentation"].includes(arg)) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const value = args[++i];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    if (arg === "--count") {
      count = Number(value);
    } else if (arg === "--output") {
      output = value;
    } else if (arg === "--format") {
      if (value !== "v0" && value !== "v1")
        throw new Error("Format must be v0 or v1");
      format = value;
    } else {
      if (!["standard", "proportional", "math"].includes(value))
        throw new Error("Unknown presentation preset");
      preset = value as typeof preset;
    }
  }

  const root = buildProportionGraph(count);
  const presentation = createPresentation(preset);
  root.paintGroup().forEach((group) =>
    group.siblings().forEach((node) => {
      presentation.nodeStyles[String(node.id())] =
        node.value() === undefined
          ? "bud"
          : node.value() === ""
          ? "block"
          : "slot";
    })
  );
  if (format === "v0" && args.includes("--presentation")) {
    throw new Error("Presentation rules require --format v1");
  }
  const document =
    format === "v0"
      ? serializeParsegraph(root)
      : serializeParsegraphDocument(root, { presentation });
  const json = JSON.stringify(document, null, 2) + "\n";
  if (output && output !== "-") {
    const filename = resolve(output);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, json, "utf8");
    console.error(
      `Wrote ${filename} (${count * count + 4 * count + 4} nodes).`
    );
  } else {
    process.stdout.write(json);
  }
}

if (require.main === module) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
