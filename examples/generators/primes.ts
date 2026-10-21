import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  DirectionCaret,
  DirectionNode,
  createPresentation,
  serializeParsegraph,
  serializeParsegraphDocument,
} from "../../src";

/** Static snapshot of graph-js's PrimesWidget, through count inclusive. */
export function buildPrimesGraph(count = 30): DirectionNode<string> {
  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    throw new Error("Count must be an integer between 1 and 1000.");
  }
  const caret = new DirectionCaret<string>("1");
  caret.node().setId("primes-1");
  const knownPrimes: number[] = [];
  for (let number = 2; number <= count; ++number) {
    caret.spawnMove("f", String(number)).setId(`primes-${number}`);
    caret.push();
    caret.pull("u");
    let isPrime = true;
    for (let i = 0; i < knownPrimes.length; ++i) {
      const prime = knownPrimes[i];
      const divides = number % prime === 0;
      caret
        .spawnMove("u", divides ? String(prime) : "")
        .setId(`primes-${number}-factor-${prime}`);
      if (divides) isPrime = false;
      // Preserve the old widget's natural paint-group interval.
      if (i % 250 === 0) caret.crease();
    }
    if (isPrime) {
      caret
        .spawnMove("u", String(number))
        .setId(`primes-${number}-factor-${number}`);
      knownPrimes.push(number);
    }
    caret.pop();
  }
  return caret.root();
}

export function buildPrimesDocument(count = 30) {
  const root = buildPrimesGraph(count);
  const presentation = createPresentation("math");
  // Match Ulam's uniform cells so labels and empty slots share a grid.
  const side = (String(count).length + 2) * presentation.text.fontSize;
  for (const style of Object.values(presentation.styles)) {
    style.minWidth = style.minHeight = side;
  }
  root.paintGroup().forEach((group) =>
    group.siblings().forEach((node) => {
      presentation.nodeStyles[String(node.id())] =
        node.value() === "" ? "slot" : "block";
    })
  );
  return serializeParsegraphDocument(root, { presentation });
}

function main(args: string[]) {
  let count = 30;
  let format = "v1";
  let output: string | undefined;
  for (let i = 0; i < args.length; ++i) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: primes.ts [--count 1..1000] [--format v0|v1] [--output FILE]\nDefaults: numbers 1 through 30 inclusive, v1 math presentation, JSON on stdout."
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
      ? buildPrimesDocument(count)
      : serializeParsegraph(buildPrimesGraph(count));
  const json = JSON.stringify(data, null, 2) + "\n";
  if (output && output !== "-") {
    const filename = resolve(output);
    mkdirSync(dirname(filename), { recursive: true });
    writeFileSync(filename, json, "utf8");
    console.error(`Wrote ${filename} (numbers 1 through ${count}).`);
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
