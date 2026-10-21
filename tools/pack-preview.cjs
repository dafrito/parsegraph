const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "parsegraph-preview-"));
try {
  const staging = path.join(temporary, "package");
  fs.mkdirSync(staging);
  for (const filename of [
    "LICENSE",
    "README.md",
    "SERIALIZATION.md",
    "DEPLOYING.md",
  ])
    fs.copyFileSync(path.join(root, filename), path.join(staging, filename));
  for (const [source, destination] of [
    ["dist-prod", "dist"],
    ["docs", "docs"],
    ["examples", "examples"],
  ]) {
    fs.cpSync(path.join(root, source), path.join(staging, destination), {
      recursive: true,
      filter: (name) =>
        !/\.spec\.[jt]s(?:\.map)?$/.test(name) &&
        !/\.spec\.d\.ts(?:\.map)?$/.test(name),
    });
  }
  // Include the source entry point used by examples; no node_modules or outputs.
  fs.cpSync(path.join(root, "src"), path.join(staging, "src"), {
    recursive: true,
    filter: (name) => !/\.spec\.[jt]s$/.test(name),
  });
  fs.cpSync(path.join(root, "tools/svg"), path.join(staging, "tools/svg"), {
    recursive: true,
    filter: (name) => !/\.spec\.[jt]s$/.test(name),
  });
  const original = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  const metadata = { ...original, private: true };
  delete metadata.scripts;
  delete metadata.devDependencies;

  const digest = createHash("sha256");
  digest.update(JSON.stringify(metadata));
  function hashDirectory(directory, prefix = "") {
    for (const name of fs.readdirSync(directory).sort()) {
      const filename = path.join(directory, name);
      const relative = prefix + name;
      if (fs.statSync(filename).isDirectory())
        hashDirectory(filename, relative + "/");
      else {
        digest.update(relative + "\0");
        digest.update(fs.readFileSync(filename));
        digest.update("\0");
      }
    }
  }
  hashDirectory(staging);
  metadata.version =
    original.version + "-v1.local." + digest.digest("hex").slice(0, 16);
  fs.writeFileSync(
    path.join(staging, "package.json"),
    JSON.stringify(metadata, null, 2) + "\n"
  );
  const destination = path.join(root, "generated");
  fs.mkdirSync(destination, { recursive: true });
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
        destination,
      ],
      { cwd: staging, encoding: "utf8" }
    )
  )[0];
  const archive = path.join(destination, packed.filename);
  // Test the artifact a consumer will actually receive, not the source tree.
  const extracted = path.join(temporary, "extracted");
  fs.mkdirSync(extracted);
  execFileSync("tar", ["-xzf", archive, "-C", extracted]);
  execFileSync(
    process.execPath,
    [
      path.join(__dirname, "verify-preview.cjs"),
      path.join(extracted, "package"),
    ],
    { stdio: "inherit" }
  );
  fs.writeFileSync(
    path.join(destination, "preview-package.json"),
    JSON.stringify(
      {
        name: packed.name,
        version: metadata.version,
        filename: packed.filename,
        integrity: packed.integrity,
        shasum: packed.shasum,
      },
      null,
      2
    ) + "\n"
  );
  console.log(`Verified local preview: ${archive}`);
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}
