const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const topLevel = [
  "LICENSE",
  "README.md",
  "CHANGELOG.md",
  "SERIALIZATION.md",
  "DEPLOYING.md",
];
const specifications = [
  "parsegraph-v1.md",
  "appearance-v1.md",
  "generation-v1.md",
  "freeform-handoff.md",
];
const required = [
  "package.json",
  ...topLevel,
  ...specifications.map((name) => "docs/" + name),
  "dist/src/index.js",
  "dist/src/index.js.map",
  "dist/src/index.d.ts",
  "dist/src/document/index.d.ts",
  "src/index.ts",
  "tools/svg/render.ts",
  "examples/fixtures/appearance-colors.parsegraph",
  ...["standard", "proportional", "math"].flatMap((name) => [
    `examples/fixtures/proportion-${name}.parsegraph`,
    `examples/fixtures/proportion-${name}.geometry.json`,
  ]),
];

function allowedFile(name) {
  if (name.split("/").some((part) => part === ".." || part.startsWith(".")))
    return false;
  if (/(?:^|\/)(?:node_modules|__tests__)(?:\/|$)|\.(?:spec|test)\./.test(name))
    return false;
  if (topLevel.includes(name) || name === "package.json") return true;
  if (name.startsWith("docs/")) return specifications.includes(name.slice(5));
  if (
    /^dist\/src\/(?:index\.js(?:\.map|\.LICENSE\.txt)?|.+\.d\.ts)$/.test(name)
  )
    return true;
  if (/^src\/.+\.ts$/.test(name)) return true;
  if (
    /^examples\/(?:README\.md|tsconfig\.json|generators\/[^/]+\.ts|fixtures\/[^/]+\.(?:parsegraph|json|md))$/.test(
      name
    )
  )
    return true;
  return /^tools\/svg\/[^/]+\.(?:ts|js|json|md)$/.test(name);
}

function filesIn(directory, prefix = "") {
  const files = [];
  for (const name of fs.readdirSync(directory).sort()) {
    const filename = path.join(directory, name);
    const stat = fs.lstatSync(filename);
    assert.ok(
      !stat.isSymbolicLink(),
      `Package must not contain symlinks: ${prefix + name}`
    );
    if (stat.isDirectory())
      files.push(...filesIn(filename, prefix + name + "/"));
    else {
      assert.ok(stat.isFile(), `Not a regular package file: ${prefix + name}`);
      files.push(prefix + name);
    }
  }
  return files;
}

function auditPackage(directory) {
  const files = filesIn(directory);
  for (const name of files)
    assert.ok(allowedFile(name), `Unexpected package file: ${name}`);
  for (const name of required)
    assert.ok(files.includes(name), `Missing package file: ${name}`);
  const metadata = JSON.parse(
    fs.readFileSync(path.join(directory, "package.json"), "utf8")
  );
  assert.equal(metadata.name, "parsegraph");
  assert.equal(metadata.main, "dist/src/index.js");
  assert.equal(metadata.types, "dist/src/index.d.ts");
  assert.equal(
    metadata.scripts,
    undefined,
    "Consumers must not receive build or lifecycle scripts"
  );
  assert.equal(metadata.devDependencies, undefined);
  if (metadata.private)
    assert.match(metadata.version, /^\d+\.\d+\.\d+-v1\.local\.[a-f0-9]{16}$/);
  else assert.match(metadata.version, /^\d+\.\d+\.\d+$/);
  const map = JSON.parse(
    fs.readFileSync(path.join(directory, "dist/src/index.js.map"), "utf8")
  );
  assert.ok(
    map.sources.length > 0,
    "The runtime source map must include sources"
  );
  assert.equal(map.sourcesContent.length, map.sources.length);
  assert.ok(
    map.sourcesContent.every((source) => typeof source === "string"),
    "Runtime source maps must embed every source"
  );
  for (const filename of files.filter((name) => name.endsWith(".d.ts"))) {
    assert.ok(
      !fs
        .readFileSync(path.join(directory, filename), "utf8")
        .includes("sourceMappingURL="),
      `Broken declaration map: ${filename}`
    );
  }
  return { metadata, files };
}

function stagePackage(root, staging, preview = false) {
  fs.mkdirSync(staging, { recursive: true });
  for (const filename of topLevel)
    fs.copyFileSync(path.join(root, filename), path.join(staging, filename));
  for (const [source, destination] of [
    ["dist-prod", "dist"],
    ["src", "src"],
    ["docs", "docs"],
    ["examples", "examples"],
    ["tools/svg", "tools/svg"],
  ]) {
    for (const name of filesIn(path.join(root, source))) {
      const relative = destination + "/" + name;
      if (!allowedFile(relative)) continue;
      const target = path.join(staging, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(root, source, name), target);
    }
  }
  const original = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  assert.equal(original.name, "parsegraph");
  assert.match(
    original.version,
    /^\d+\.\d+\.\d+$/,
    "Set a stable x.y.z source version before packaging"
  );
  const metadata = { ...original };
  for (const key of ["scripts", "devDependencies", "private", "packageManager"])
    delete metadata[key];
  metadata.files = [
    ...topLevel,
    "dist",
    "src",
    "docs",
    "examples",
    "tools/svg",
  ];
  if (preview) {
    metadata.private = true;
    const digest = createHash("sha256").update(JSON.stringify(metadata));
    for (const filename of filesIn(staging)) {
      digest.update(filename + "\0");
      digest.update(fs.readFileSync(path.join(staging, filename)));
      digest.update("\0");
    }
    metadata.version += "-v1.local." + digest.digest("hex").slice(0, 16);
  }
  fs.writeFileSync(
    path.join(staging, "package.json"),
    JSON.stringify(metadata, null, 2) + "\n"
  );
  auditPackage(staging);
  return metadata;
}

function archiveHashes(filename) {
  const bytes = fs.readFileSync(filename);
  return {
    integrity: "sha512-" + createHash("sha512").update(bytes).digest("base64"),
    shasum: createHash("sha1").update(bytes).digest("hex"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

function packPackage(preview = false) {
  const root = path.resolve(__dirname, "..");
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "parsegraph-package-")
  );
  const destination = path.join(root, "generated");
  const receipt = path.join(
    destination,
    preview ? "preview-package.json" : "release-package.json"
  );
  // A failed package must never leave a receipt asserting a prior success.
  fs.rmSync(receipt, { force: true });
  try {
    const staging = path.join(temporary, "package");
    const metadata = stagePackage(root, staging, preview);
    const packed = JSON.parse(
      execFileSync(
        "npm",
        [
          "pack",
          "--ignore-scripts",
          "--offline",
          "--json",
          "--cache",
          path.join(temporary, "npm-cache"),
          "--pack-destination",
          temporary,
        ],
        { cwd: staging, encoding: "utf8" }
      )
    )[0];
    const archive = path.join(temporary, packed.filename);
    execFileSync(
      process.execPath,
      [path.join(__dirname, "verify-package.cjs"), archive],
      { stdio: "inherit" }
    );
    const hashes = archiveHashes(archive);
    assert.equal(hashes.integrity, packed.integrity);
    assert.equal(hashes.shasum, packed.shasum);
    fs.mkdirSync(destination, { recursive: true });
    fs.copyFileSync(archive, path.join(destination, packed.filename));
    fs.writeFileSync(
      receipt,
      JSON.stringify(
        {
          name: packed.name,
          version: metadata.version,
          filename: packed.filename,
          ...hashes,
        },
        null,
        2
      ) + "\n"
    );
    console.log(
      `Verified ${preview ? "private preview" : "release"}: ${path.join(
        destination,
        packed.filename
      )}`
    );
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

module.exports = {
  allowedFile,
  filesIn,
  required,
  auditPackage,
  stagePackage,
  archiveHashes,
  packPackage,
};
