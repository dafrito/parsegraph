const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const {
  required,
  stagePackage,
  auditPackage,
  filesIn,
} = require("./package.cjs");

function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "parsegraph-pack-test-")
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, "repo");
  function write(name, content = "fixture\n") {
    const filename = path.join(root, name);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
  }
  for (const name of required) write(name.replace(/^dist\//, "dist-prod/"));
  write(
    "package.json",
    JSON.stringify({
      name: "parsegraph",
      version: "7.0.0",
      main: "dist/src/index.js",
      types: "dist/src/index.d.ts",
      private: true,
      scripts: { prepack: "exit 1" },
      devDependencies: { typescript: "4.9.5" },
    })
  );
  write(
    "dist-prod/src/index.js.map",
    JSON.stringify({
      sources: ["index.ts"],
      sourcesContent: ["export {};"],
      mappings: "",
    })
  );
  return {
    root,
    write,
    stage: (name, preview = false) => {
      const target = path.join(directory, name);
      return {
        directory: target,
        metadata: stagePackage(root, target, preview),
      };
    },
  };
}

test("release is publishable and previews are content-addressed private packages", (t) => {
  const { stage, write } = fixture(t);
  const release = stage("release");
  assert.equal(release.metadata.version, "7.0.0");
  assert.equal(release.metadata.private, undefined);
  assert.equal(release.metadata.scripts, undefined);
  assert.equal(release.metadata.devDependencies, undefined);
  const first = stage("first", true);
  assert.equal(first.metadata.private, true);
  assert.equal(stage("same", true).metadata.version, first.metadata.version);
  write("src/index.ts", "export const changed = true;\n");
  assert.notEqual(
    stage("changed", true).metadata.version,
    first.metadata.version
  );
});

test("staging excludes native outputs, test declarations, stale docs and declaration maps", (t) => {
  const { write, stage } = fixture(t);
  for (const name of [
    "native/build/libparsegraph.a",
    "dist/src/index.js",
    "dist-prod/coverage/index.html",
    "dist-prod/src/Layout.spec.d.ts",
    "dist-prod/src/index.d.ts.map",
    "src/DirectionNode.spec.ts",
    "tools/svg/render.spec.js",
    "docs/generated/index.html",
    "examples/generators/private.test.ts",
  ])
    write(name, "must not ship");
  const release = stage("release");
  for (const name of filesIn(release.directory)) {
    assert.notEqual(
      fs.readFileSync(path.join(release.directory, name), "utf8"),
      "must not ship",
      name
    );
  }
});

test("audit rejects extra files and missing required consumer contracts", (t) => {
  const { stage } = fixture(t);
  const { directory } = stage("release");
  fs.writeFileSync(path.join(directory, "unexpected.key"), "private material");
  assert.throws(() => auditPackage(directory), /Unexpected package file/);
  fs.unlinkSync(path.join(directory, "unexpected.key"));
  fs.unlinkSync(path.join(directory, "dist/src/document/index.d.ts"));
  assert.throws(() => auditPackage(directory), /Missing package file/);
});

test("audit rejects source maps without embedded sources and dangling declaration maps", (t) => {
  const { write, stage } = fixture(t);
  write(
    "dist-prod/src/index.js.map",
    JSON.stringify({ sources: ["absent.ts"], sourcesContent: [null] })
  );
  assert.throws(() => stage("broken-runtime-map"), /embed every source/);
  write(
    "dist-prod/src/index.js.map",
    JSON.stringify({ sources: ["index.ts"], sourcesContent: ["export {};"] })
  );
  write(
    "dist-prod/src/index.d.ts",
    "export {};\n//# sourceMappingURL=index.d.ts.map\n"
  );
  assert.throws(
    () => stage("broken-declaration-map"),
    /Broken declaration map/
  );
});

test("staging rejects symlink content instead of following files outside the package", (t) => {
  const { root, stage } = fixture(t);
  fs.symlinkSync(
    path.join(root, "README.md"),
    path.join(root, "src/external.ts")
  );
  assert.throws(() => stage("symlink"), /must not contain symlinks/);
});

test("root lifecycle guard fails before npm can package a stale development build", () => {
  const result = spawnSync(
    process.execPath,
    [path.join(__dirname, "prepack.cjs")],
    { encoding: "utf8" }
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /yarn pack:release/);
});
