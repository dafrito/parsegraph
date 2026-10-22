const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
for (const name of ["release-package.json", "preview-package.json"]) {
  fs.rmSync(path.join(root, "generated", name), { force: true });
}
// Webpack only replaces emitted files. Remove declarations from deleted source
// files and earlier test builds before creating any production artifact.
fs.rmSync(path.join(root, "dist-prod"), { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [
    require.resolve("webpack-cli/bin/cli.js"),
    "--mode",
    "production",
    "--config",
    "config/webpack.prod.js",
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "inherit",
  }
);
if (result.error) throw result.error;
process.exit(result.status === null ? 1 : result.status);
