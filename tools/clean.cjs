const fs = require("node:fs");
const path = require("node:path");

function clean(root) {
  const generated = path.join(root, "generated");
  let outputs = [];
  try {
    const stat = fs.lstatSync(generated);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("Refusing to clean: generated must be a real directory");
    }
    outputs = fs.readdirSync(generated, { withFileTypes: true });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  // These are disposable build/staging directories, including legacy outputs.
  // rmSync removes a directory symlink itself without traversing its target.
  for (const name of [
    "dist",
    "dist-prod",
    "dist-types",
    "dist-tools",
    "parsegraph",
  ]) {
    fs.rmSync(path.join(root, name), { recursive: true, force: true });
  }
  for (const name of [
    "parsegraph-dev.tgz",
    "parsegraph.tgz",
    "dependencygraph.svg",
  ]) {
    fs.rmSync(path.join(root, name), { force: true });
  }

  // Keep generated/README.md, unknown files, and subdirectories. Committed
  // example fixtures live outside generated/ and are never cleanup targets.
  const receipts = new Set([
    "preview-package.json",
    "release-package.json",
    "SHA256SUMS",
  ]);
  for (const output of outputs) {
    if (!output.isFile() && !output.isSymbolicLink()) continue;
    if (
      /\.(?:parsegraph|svg|png|tgz)$/.test(output.name) ||
      receipts.has(output.name)
    ) {
      fs.rmSync(path.join(generated, output.name), { force: true });
    }
  }
}

if (require.main === module) {
  if (process.argv.length !== 2) {
    console.error("Usage: yarn clean (no arguments)");
    process.exitCode = 1;
  } else {
    clean(path.resolve(__dirname, ".."));
  }
}

module.exports = { clean };
