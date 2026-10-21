# CI and deploying

## Continuous integration

`.github/workflows/ci.yml` checks pull requests, pushes to `main`, and manual
runs on Ubuntu with Node 22 and 24. It installs dependencies from `yarn.lock`
using `yarn install --frozen-lockfile --non-interactive`. Use Yarn Classic (1.x)
for this repository; CI explicitly uses `yarn.lock`, even though the historical
`package-lock.json` is also present.

Each Node version runs formatting/lint checks, Jest with coverage, development
and production builds, package staging, a smoke test of the extracted production
archive, and TypeDoc. The package smoke test loads the package through its
declared entry point, checks that its declaration entry point exists, and lays
out a node. Webpack's `ts-loader` also type-checks the source during both builds;
Jest alone uses Babel and does not type-check.

Successful runs upload the production archive and API docs. Coverage is uploaded
even if another check fails, when available. Artifacts are retained for 14 days.
CI requires no repository secrets and does not publish anything to npm or the
documentation server. New runs cancel older CI runs for the same ref.

To reproduce the checks locally:

```sh
yarn install --frozen-lockfile --non-interactive
yarn lint:ci
yarn test:cov --ci --runInBand
yarn build
yarn tar
yarn build:prod
yarn tar:prod
yarn doc
```

The workflow also contains the archive smoke test. The generated production
package is `parsegraph.tgz`; documentation and coverage are under `dist/`.
ESLint's existing JSDoc warnings are reported but do not fail the check. There
is currently no coverage threshold.

## Package script inventory

| Command (`yarn ...`) | Purpose and CI use |
| --- | --- |
| `all` | Runs the fixing lint command, coverage, development build, and docs. Omits production build/packaging; CI uses explicit steps instead. |
| `build` | Development UMD bundle and TypeScript declarations in `dist/src`. Checked in CI. |
| `build:watch` | Development build in watch mode; local use. |
| `build:prod` | Minified production UMD bundle and declarations in `dist-prod/src`. Checked in CI. |
| `build:prod:watch` | Production build in watch mode; local use. |
| `dependencygraph` | Generates `dependencygraph.svg`. Requires external `ts_dependency_graph` and Graphviz `dot`, neither installed by this package; excluded from CI. |
| `test` | Jest in jsdom, with caching disabled. Covered by `test:cov` in CI. |
| `test:watch` | Interactive Jest watch mode; local use. |
| `test:cov` | Runs the same tests and writes coverage to `dist/coverage`. CI adds `--ci --runInBand`. |
| `prettier` | Rewrites formatting under `src`; local use. |
| `lint:ci` | Checks formatting and ESLint without modifying files. ESLint excludes `*.spec.js` and `*.spec.ts`; formatting includes tests. |
| `lint` | Formats and applies ESLint fixes; local use. |
| `doc` | Generates TypeDoc documentation in `dist/docs`. Checked in CI. |
| `clean` | Removes build directories and archives. Legacy script has a malformed shebang; excluded from CI, which starts with a fresh checkout. |
| `tar` | Stages the existing development build in `parsegraph/`. Despite its name, it does not create an archive. Checked in CI. |
| `tar:prod` | Stages the existing production build in `parsegraph/` and creates `parsegraph.tgz`. Requires `build:prod` first; checked in CI. |
| `deploy` | Publishes the staged `parsegraph/` package to npm; excluded from CI. |
| `deploy:prod` | References `scripts/deploy-prod`, which does not exist. Requires repair before use; excluded from CI. |

There are also unexposed `scripts/publish` and `scripts/publish-prod` helpers.
They expect development/production archives respectively. The production helper
can reset `package.json` while retrying; neither helper is used by CI.

## Existing deployment workflow

The separate `.github/workflows/deploy.js.yml` still attempts deployment on every
push to `main`. It runs its own checks and does not wait for the new CI workflow.
It uses legacy action versions, including `actions/upload-artifact@v2`, and has
not been modernized or validated as part of adding CI. Deployment remains a
separate maintenance task; a green CI run does not establish that publishing
works. The deployment instructions and secrets below describe that existing
workflow.

## Prerequisites

The existing workflow expects a new package version on `main` and the secrets
listed below. Its action versions and publishing behavior still need validation.

After its checks, it attempts to publish the build to npm and the documentation
to parsegraph.com/docs.

## Secrets

### PARSEGRAPH_SSH_HOST

Format: user@example.com

The SSH host used for ssh commands. Do not include a trailing colon.

### PARSEGRAPH_SSH_TOKEN

Format: base64-encoded contents of the SSH private key

The next token must be kept in sync with this one.

### PARSEGRAPH_SSH_TOKEN_SHA1SUM

Format: only the SHA1 hash string; do not include the filename or spaces

This is the SHA1 hash of the token used for PARSEGRAPH_SSH_TOKEN. This is the hash of the file itself, not the base64-encoded string.

### PARSEGRAPH_SSH_KNOWN_HOST

Format: base64-encoded lines from ~/.ssh/known_hosts corresponding to PARSEGRAPH_SSH_HOST

### PARSEGRAPH_GITHUB_PATH

Format: Absolute path to the remote Github directory for uploads. Do not include a trailing slash.

### PARSEGRAPH_DOCS_PATH

Format: Absolute path to remote parsegraph public documents directory. Do not include a trailing slash.


### NPM_PUBLISH_TOKEN

The NPM token used for yarn deploy
