import { randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DirectionCaret,
  createPresentation,
  serializeParsegraph,
  serializeParsegraphDocument,
} from "../../src";
import { createSeededRandom } from "./random";

function buildMemoryPiers(count: number, seed: number) {
  if (!Number.isInteger(count) || count < 1 || count > 200) {
    throw new Error("Count must be an integer between 1 and 200.");
  }
  const random = createSeededRandom(seed);
  const presentation = createPresentation();
  // Original shape proportions, normalized to a bud diameter of 7.5.
  for (const name of ["block", "slot"]) {
    presentation.styles[name] = {
      minWidth: 37.5,
      minHeight: 30,
      paddingX: 7.5,
      paddingY: 1.25,
      square: false,
    };
  }
  presentation.styles.slider = {
    minWidth: 320,
    minHeight: 15,
    paddingX: 1.25,
    paddingY: 1.25,
    square: false,
  };
  const caret = new DirectionCaret<string>();
  let nextId = 0;
  const identify = (node: ReturnType<typeof caret.node>, style: string) => {
    const id = `memory-piers-${nextId++}`;
    node.setId(id);
    presentation.nodeStyles[id] = style;
    return node;
  };
  const spawnMove = (direction: string, style: string) =>
    identify(
      caret.spawnMove(direction, style === "bud" ? undefined : ""),
      style
    );
  const spawn = (direction: string, style: string) =>
    identify(caret.spawn(direction, style === "bud" ? undefined : ""), style);
  identify(caret.node(), "bud");
  caret.fitLoose();
  spawnMove("f", "bud");
  for (let i = 0; i < count; ++i) {
    caret.push();
    caret.crease();
    const direction = i % 2 === 0 ? "d" : "u";
    for (let j = 0; j < count; ++j) {
      // The original draws once here even though both branches do the same
      // thing. Preserve its random-call order for reproducible ports.
      random();
      if (j === 0) caret.pull(direction);
      spawnMove(direction, "slot");
      for (const [side, back] of [
        ["b", "f"],
        ["f", "b"],
      ]) {
        if (Math.floor(random() * 2) === 0) {
          caret.pull(side);
          spawnMove(side, "block");
          spawn("d", "slider");
          caret.move(back);
        }
      }
    }
    for (const [side, back] of [
      ["f", "b"],
      ["b", "f"],
    ]) {
      if (!caret.has(side)) {
        caret.pull(side);
        spawnMove(side, "bud");
        spawn(side, "bud");
        caret.move(back);
      }
    }
    caret.pop();
    // Preserve the original's final trailing bud, too.
    spawnMove("f", "bud");
  }
  return { root: caret.root(), presentation };
}

/** Static structure from showMemoryBlocks; explicit seeds give stable IDs. */
export function buildMemoryPiersGraph(count = 12, seed = 0) {
  return buildMemoryPiers(count, seed).root;
}

export function buildMemoryPiersDocument(count = 12, seed = 0) {
  const { root, presentation } = buildMemoryPiers(count, seed);
  return serializeParsegraphDocument(root, {
    presentation,
    capabilities: {
      "generation/1": {
        generator: { name: "memory-piers", revision: 1 },
        random: { algorithm: "lcg32/1", seed },
        parameters: { count },
      },
    },
  });
}

function main(args: string[]) {
  let count = 12;
  let seed: number | undefined;
  let output: string | undefined;
  let format = "v1";
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: memory-piers.ts [--count 1..200] [--seed 0..4294967295] [--format v0|v1] [--output FILE]\nDefaults: 12 columns of 12 slots, a fresh random seed, v1, JSON on stdout."
      );
      return;
    }
    if (!["--count", "--seed", "--format", "--output"].includes(arg))
      throw new Error(`Unknown argument: ${arg}`);
    const value = args[++i];
    if (value === undefined || value.startsWith("--"))
      throw new Error(`Missing value for ${arg}`);
    if (arg === "--count") count = Number(value);
    else if (arg === "--seed") seed = Number(value);
    else if (arg === "--output") output = value;
    else {
      if (value !== "v0" && value !== "v1")
        throw new Error("Format must be v0 or v1");
      format = value;
    }
  }
  seed = seed ?? randomBytes(4).readUInt32LE(0);
  const data =
    format === "v1"
      ? buildMemoryPiersDocument(count, seed)
      : serializeParsegraph(buildMemoryPiersGraph(count, seed));
  const json = JSON.stringify(data, null, 2) + "\n";
  console.error(`Memory Piers: count=${count}, seed=${seed} (lcg32/1).`);
  if (format === "v0")
    console.error("V0 omits presentation and embedded generation information.");
  if (output && output !== "-") {
    const filename = resolve(output);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, json, "utf8");
    console.error(`Wrote ${filename}.`);
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
