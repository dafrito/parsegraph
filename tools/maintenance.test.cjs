const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const { clean } = require("./clean.cjs");
const { scripts } = require("../package.json");

function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "parsegraph-maintenance-")
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, "checkout with spaces");
  fs.mkdirSync(root);
  const write = (name, content = "keep or remove this fixture\n") => {
    const filename = path.join(root, name);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.writeFileSync(filename, content);
    return filename;
  };
  return { directory, root, write };
}

test("clean removes declared build artifacts and preserves source, fixtures, and unknown files", (t) => {
  const { root, write } = fixture(t);
  const removed = [
    "dist/src/index.js",
    "dist-prod/src/index.js",
    "dist-types/index.d.ts",
    "dist-tools/svg.js",
    "parsegraph/package.json",
    "parsegraph-dev.tgz",
    "parsegraph.tgz",
    "dependencygraph.svg",
    "generated/proportion.parsegraph",
    "generated/demo.svg",
    "generated/demo.png",
    "generated/parsegraph-7.0.1.tgz",
    "generated/parsegraph-docs-7.0.1.tgz",
    "generated/preview-package.json",
    "generated/release-package.json",
    "generated/SHA256SUMS",
  ];
  const preserved = [
    "generated/README.md",
    "generated/notes.md",
    "generated/unknown.json",
    "generated/archive/kept.svg",
    "generated/folder.svg/keep.txt",
    "examples/fixtures/proportion.parsegraph",
    "docs/parsegraph-v1.md",
    "src/index.ts",
    "node_modules/installed/package.json",
    "native/build/keep.a",
    ".vscode/settings.json",
    "yarn.lock",
  ];
  for (const name of [...removed, ...preserved]) write(name, name);
  clean(root);
  for (const name of removed)
    assert.equal(fs.existsSync(path.join(root, name)), false, name);
  for (const name of preserved)
    assert.equal(fs.readFileSync(path.join(root, name), "utf8"), name);
  clean(root); // An already-clean checkout is valid.
});

test("clean wrapper anchors to its checkout when launched from an unrelated directory", (t) => {
  const { directory, root, write } = fixture(t);
  write(
    "scripts/clean",
    fs.readFileSync(path.join(__dirname, "../scripts/clean"))
  );
  write("tools/clean.cjs", fs.readFileSync(path.join(__dirname, "clean.cjs")));
  fs.chmodSync(path.join(root, "scripts/clean"), 0o755);
  write("dist/compiled.js");
  const caller = path.join(directory, "unrelated caller");
  fs.mkdirSync(path.join(caller, "dist"), { recursive: true });
  const otherOutput = path.join(caller, "dist/owned.js");
  fs.writeFileSync(otherOutput, "caller data");
  const result = spawnSync(path.join(root, "scripts/clean"), [], {
    cwd: caller,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: path.dirname(process.execPath) + path.delimiter + process.env.PATH,
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
  assert.equal(fs.readFileSync(otherOutput, "utf8"), "caller data");
});

test("clean rejects a redirected generated directory before removing any build output", (t) => {
  const { directory, root, write } = fixture(t);
  const outside = path.join(directory, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "personal.svg"), "external data");
  fs.symlinkSync(outside, path.join(root, "generated"), "dir");
  write("dist/compiled.js", "still here");
  assert.throws(() => clean(root), /generated must be a real directory/);
  assert.equal(
    fs.readFileSync(path.join(outside, "personal.svg"), "utf8"),
    "external data"
  );
  assert.equal(
    fs.readFileSync(path.join(root, "dist/compiled.js"), "utf8"),
    "still here"
  );
});

test("clean command rejects arguments without removing outputs", (t) => {
  const { root, write } = fixture(t);
  const program = write(
    "tools/clean.cjs",
    fs.readFileSync(path.join(__dirname, "clean.cjs"))
  );
  write("dist/compiled.js", "still here");
  const result = spawnSync(process.execPath, [program, "../another-checkout"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /no arguments/);
  assert.equal(
    fs.readFileSync(path.join(root, "dist/compiled.js"), "utf8"),
    "still here"
  );
});

test("clean unlinks artifact symlinks without traversing their targets", (t) => {
  const { directory, root, write } = fixture(t);
  const outside = path.join(directory, "outside");
  fs.mkdirSync(outside);
  const externalFile = path.join(outside, "valuable.svg");
  fs.writeFileSync(externalFile, "external data");
  fs.symlinkSync(outside, path.join(root, "dist"), "dir");
  write("generated/README.md", "keep");
  fs.symlinkSync(externalFile, path.join(root, "generated/linked.svg"));
  clean(root);
  assert.equal(fs.existsSync(path.join(root, "dist")), false);
  assert.equal(fs.existsSync(path.join(root, "generated/linked.svg")), false);
  assert.equal(fs.readFileSync(externalFile, "utf8"), "external data");
});

test("lint commands pass literal recursive and exclusion globs without invoking npx", (t) => {
  const { root, write } = fixture(t);
  const quote = (value) => "'" + value.replaceAll("'", "'\\''") + "'";
  const log = path.join(root, "commands.jsonl");
  const logger = write(
    "log.cjs",
    "require('node:fs').appendFileSync(process.env.COMMAND_LOG, JSON.stringify(process.argv.slice(2)) + '\\n');\n"
  );
  for (const name of ["yarn", "prettier", "eslint"]) {
    const executable = write(
      "bin/" + name,
      `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(
        logger
      )} ${name} "$@"\n`
    );
    fs.chmodSync(executable, 0o755);
  }
  const npx = write("bin/npx", "#!/bin/sh\nexit 97\n");
  fs.chmodSync(npx, 0o755);
  // These filenames would expand an unquoted exclusion glob in the shell.
  write("unrelated.spec.ts");
  write("unrelated.spec.js");
  write("src/nested/value.ts");
  const run = (command) => {
    fs.writeFileSync(log, "");
    const result = spawnSync("/bin/sh", ["-c", command], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: path.join(root, "bin") + path.delimiter + process.env.PATH,
        COMMAND_LOG: log,
      },
    });
    assert.equal(result.status, 0, result.stderr);
    return fs.readFileSync(log, "utf8").trim().split("\n").map(JSON.parse);
  };
  const check = run(scripts["lint:ci"]);
  const fix = run(scripts.lint);
  assert.deepEqual(check[0], ["prettier", "--check", "src"]);
  assert.deepEqual(fix[0], ["yarn", "prettier"]);
  assert.deepEqual(check[1], [
    "eslint",
    "src/**",
    "--ignore-pattern",
    "*.spec.js",
    "--ignore-pattern",
    "*.spec.ts",
  ]);
  assert.deepEqual(
    fix[1].filter((arg) => arg !== "--fix"),
    check[1]
  );
  assert.equal(fix[1].includes("--fix"), true);
  assert.deepEqual(run(scripts.all)[0], ["yarn", "lint:ci"]);
});
