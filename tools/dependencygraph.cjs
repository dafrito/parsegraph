const { spawnSync } = require("node:child_process");
const { writeFileSync } = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function run(command, args, input) {
  const result = spawnSync(command, args, {
    cwd: root,
    input,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60000,
  });
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) {
    throw new Error(`${command}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed (${result.signal || result.status})`);
  }
  return result.stdout;
}

try {
  const dot = run("ts_dependency_graph", ["--start", "src/index.ts", "--graph_folder"]);
  // This generator uses plain filename labels, without record fields/ports.
  // Record shapes can lose edges between adjacent nodes on the same rank.
  // Limit the replacement to its node declarations, leaving edges intact.
  const boxes = dot.replace(/^(\s*"[^"\n]+" \[)shape=record\b/gm, "$1shape=box");
  const svg = run("dot", ["-T", "svg"], boxes);
  // Neither a failed scan nor a failed layout truncates the previous image.
  writeFileSync(path.join(root, "dependencygraph.svg"), svg);
  console.log("Wrote dependencygraph.svg");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
