const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { auditPackage } = require("./package.cjs");

function verifyArchive(archive) {
  archive = path.resolve(archive);
  const consumer = fs.mkdtempSync(
    path.join(os.tmpdir(), "parsegraph-consumer-")
  );
  try {
    // Refuse unexpected paths and links before asking tar to extract anything.
    const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" })
      .trim()
      .split("\n");
    assert.ok(listing.length > 0);
    for (const name of listing) {
      assert.ok(name.startsWith("package/"), `Invalid archive root: ${name}`);
      assert.ok(
        !name.split("/").some((part) => part === ".." || part === "."),
        `Unsafe archive path: ${name}`
      );
      assert.ok(!name.includes("\\"), `Unsafe archive path: ${name}`);
    }
    const verbose = execFileSync("tar", ["-tvzf", archive], {
      encoding: "utf8",
    })
      .trim()
      .split("\n");
    assert.ok(
      verbose.every((line) => line[0] === "-" || line[0] === "d"),
      "Archive must contain only regular files and directories"
    );
    execFileSync("tar", ["-xzf", archive, "-C", consumer]);
    fs.mkdirSync(path.join(consumer, "node_modules"));
    const installed = path.join(consumer, "node_modules/parsegraph");
    fs.renameSync(path.join(consumer, "package"), installed);
    const { metadata, files } = auditPackage(installed);
    const options = {
      cwd: consumer,
      env: { ...process.env, NODE_PATH: "" },
      stdio: "inherit",
    };
    fs.copyFileSync(
      path.join(__dirname, "verify-preview.cjs"),
      path.join(consumer, "consumer.cjs")
    );
    execFileSync(process.execPath, ["consumer.cjs"], options);
    fs.writeFileSync(
      path.join(consumer, "consumer.ts"),
      `
import {
  DirectionNode, DirectionCaret, Direction, CommitLayout,
  createPresentation, createTextMeasurer, createPresentationPainter,
  serializeParsegraph, serializeParsegraphDocument, deserializeParsegraphDocument,
  validateParsegraphDocument, resolveNodeAppearance, ParsegraphDocument,
} from "parsegraph";
const root = new DirectionNode<string>("typed consumer");
const caret = new DirectionCaret<string>(root);
const presentation = createPresentation("math");
const document: ParsegraphDocument = serializeParsegraphDocument(caret.node(), { presentation });
validateParsegraphDocument(document);
const loaded = deserializeParsegraphDocument(document);
const painter = createPresentationPainter(presentation, createTextMeasurer(line => line.length * 6));
const layout = new CommitLayout(loaded.root, painter);
while (layout.crank());
if (deserializeParsegraphDocument(serializeParsegraph(root)).version !== 0) throw new Error("v0");
if (loaded.appearance) {
  const appearance = resolveNodeAppearance(loaded.appearance, String(root.id()));
  const alpha: number = appearance.backgroundAlpha;
}
const direction: Direction = Direction.FORWARD;
// @ts-expect-error public values remain typed
const invalid: number = root.value();
// @ts-expect-error invalid preset must not silently become any
if (false) createPresentation("invalid-preset");
`
    );
    fs.writeFileSync(
      path.join(consumer, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            module: "commonjs",
            moduleResolution: "node",
            strict: true,
            skipLibCheck: false,
            types: [],
            typeRoots: [],
            outDir: "out",
          },
          files: ["consumer.ts"],
        },
        null,
        2
      )
    );
    // Only the compiler comes from this checkout. All declarations resolve from
    // the installed archive; ambient repository/@types declarations are disabled.
    execFileSync(
      process.execPath,
      [require.resolve("typescript/bin/tsc"), "--project", "tsconfig.json"],
      options
    );
    execFileSync(process.execPath, ["out/consumer.js"], options);
    console.log(
      `Package ${metadata.version}: isolated TypeScript consumer and ${files.length}-file archive audit pass.`
    );
    return { metadata, files };
  } finally {
    fs.rmSync(consumer, { recursive: true, force: true });
  }
}

if (require.main === module) {
  assert.ok(
    process.argv[2],
    "Usage: node tools/verify-package.cjs <archive.tgz>"
  );
  verifyArchive(process.argv[2]);
}
module.exports = { verifyArchive };
