# Testing and releasing Parsegraph

## Continuous integration

`.github/workflows/ci.yml` checks pull requests, pushes to `main`, and manual
runs. It is also called by the release workflow at the released commit. Normal
CI never publishes. Dependencies come from `yarn.lock` using Yarn Classic
1.22.22 and `yarn install --frozen-lockfile --non-interactive`; do not maintain a
second npm lockfile. npm is used to produce and publish installable archives.

The JavaScript matrix runs on Ubuntu with Node 22 and 24. Each job checks
formatting and lint, generator and SVG-tool types, maintenance/packaging/release safeguards,
Jest coverage, development compilation, the production archive, and TypeDoc.
The production package is built once by `yarn pack:release`, which verifies the
actual archive through isolated consumers, public document/presentation APIs,
and deterministic geometry fixtures. npm 11.16.0 is pinned in CI packaging and
publication jobs. Release builds do not restore the JavaScript dependency cache.
Each JavaScript job also checks live npm registry reads for the known 6.2.0
release and the candidate version, so the publication transport is exercised
before a release is cut.

The native matrix remains independent: Ubuntu and macOS, Debug with sanitizers
and optimized Release, C/C++ consumer builds, native tests and TypeScript parity,
a generated SVG, and diagnostic benchmark results. These checks gate the npm
release too. Release configurations upload native static-library packages as CI
artifacts; the npm package and GitHub release attachment job do not include them.

Successful JavaScript jobs upload `parsegraph-node-22` and `parsegraph-node-24`
artifacts containing the production npm archive, its receipt, versioned API
documentation archive, and `SHA256SUMS`. Expanded API docs and coverage are also
available as CI artifacts. Retention is 14 days. Existing ESLint JSDoc warnings
do not fail CI, and there is no coverage threshold.

Local checks:

```sh
yarn install --frozen-lockfile --non-interactive
yarn lint:ci
yarn examples:check
yarn svg:check
yarn test:maintenance
yarn test:package
yarn test:release
yarn test:cov --ci --runInBand
yarn build
yarn pack:release
yarn doc
```

`yarn pack:release` writes `generated/parsegraph-7.1.0.tgz` and
`generated/release-package.json` for the current version. The receipt records
SHA512 integrity, SHA1, and SHA256 hashes. To verify an existing archive without
rebuilding it:

```sh
yarn verify:package -- generated/parsegraph-7.1.0.tgz
```

After CI downloads a complete candidate, `node tools/release.cjs verify` checks
its archive receipt and all release-asset checksums without publishing.
`node tools/release.cjs seal` creates that checksum file after packaging the
versioned TypeDoc archive; the CI workflow supplies the GNU tar command.

## Publication trigger and exact artifact

`.github/workflows/release.yml` runs only when a GitHub Release is **published**.
A push to `main`, a tag push by itself, a draft release, or a manual CI run does
not publish npm packages. The previous push-triggered deployment workflow and
legacy publishing scripts have been removed.

The current policy accepts stable `7.x.y` versions only, tagged exactly
`v7.x.y`. Prerelease distribution and a later major version require an explicit
workflow-policy change. The guard checks the repository, event, tag, package
version, and that the checkout and resolved tag both equal the release event's
commit. A moving `main` branch is never used as the release source.

The release calls the same local CI workflow at that commit and waits for both
JavaScript versions and every native configuration. It then downloads the
**Node 24 candidate from that run**. The publication job installs no project
dependencies, rebuilds nothing, verifies the candidate hashes, and passes the
exact tested `.tgz` to `npm publish --ignore-scripts`. Only that job receives
`id-token: write`; its GitHub repository permission is read-only.

A separate job attaches these files to the GitHub Release:

- `parsegraph-7.1.0.tgz`: the same bytes passed to npm.
- `parsegraph-docs-7.1.0.tgz`: the TypeDoc `docs/` tree for this version.
- `release-package.json`: package identity and archive hashes.
- `SHA256SUMS`: checksums for the other three files.

Attachment and npm publication depend on validation, not on each other. They can
be retried independently. Attachments do not deploy documentation to a website;
the website can consume the versioned archive through its own deployment.

## One-time npm trusted publisher setup

A package owner must configure `parsegraph` on npmjs.com under **Settings →
Trusted publishing → GitHub Actions**:

| Setting              | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Organization or user | `dafrito`                                                    |
| Repository           | `parsegraph`                                                 |
| Workflow filename    | `release.yml`                                                |
| Environment          | Leave blank; this workflow does not use a GitHub environment |
| Allowed actions      | Enable direct publication with `npm publish`                 |

`npm stage publish` being allowed by default is not sufficient for this workflow.
No npm write token or SSH deployment secret is used. The workflow runs on
GitHub-hosted Ubuntu with Node 24 and npm 11.16.0; trusted publishing requires at
least Node 22.14 and npm 11.5.1. The npm CLI obtains short-lived OIDC credentials
and generates provenance for the public GitHub repository. Package metadata
must identify `dafrito/parsegraph` as its repository. See the [npm trusted
publishing documentation](https://docs.npmjs.com/trusted-publishers/).

Saving the trusted publisher configuration does not validate it against a real
publication. A successful release run is the final authentication check. The old
`NPM_PUBLISH_TOKEN` and `PARSEGRAPH_SSH_*` secrets are no longer referenced and may
be removed once other workflows are confirmed not to depend on them.

## Cutting version 7

1. Finish and commit the release implementation and version `7.1.0`, including
   `yarn.lock` if dependencies changed. Push that commit to GitHub and wait for
   CI. Configure the npm trusted publisher before publishing a GitHub Release.
2. Confirm the tested tarball works in Freeform and any other consumer that
   needs the new APIs. The [Freeform handoff](docs/freeform-handoff.md) describes
   the document and geometry compatibility requirements.
3. Create tag `v7.1.0` on the intended tested commit. Create a GitHub Release for
   that exact tag with the [version 7 release notes](CHANGELOG.md), leave
   **pre-release** unchecked, and publish it. Publishing the GitHub Release is
   the action that authorizes registry publication.
4. Watch **Release** in GitHub Actions. Both npm publication and release-asset
   attachment should succeed. Check npm's version and integrity against
   `release-package.json`, then install `parsegraph@7.1.0` in consumers and
   regenerate their lockfiles. A package version in source is not evidence that
   it has been published.

Do not use `npm publish .` or publish a stale development staging directory.
The root-package guard directs maintainers to the release artifact. Local
previews remain available with `yarn pack:preview`; they have a content-derived
private prerelease version and are not registry releases.

## Retrying and failure behavior

Use GitHub Actions **Re-run failed jobs** for an interrupted publication or
attachment. Keep the original tag and commit unchanged. GitHub retains the
validated candidate for 14 days; after that the original commit must be rebuilt
and validated. Changed packaging tools can produce different bytes, which the
integrity check intentionally refuses to treat as the same release.

Before publishing, the job reads the exact version from the public npm registry
using `npm view`, with bounded network retries and a 60-second process timeout.
Only a structured npm `E404` response with normal exit status 1 permits a first
publication. Timeouts and malformed responses fail closed. An existing version is accepted only if both
its SHA512 integrity and SHA1 hash match the candidate. In that case the job
skips publication and makes no dist-tag changes. A different archive fails;
choose a new version rather than attempting to overwrite an immutable npm
version. Network errors, authorization errors, and rate limits also fail rather
than being treated as absence.

The attachment job compares any existing asset with the candidate byte for byte
by SHA256. It uploads only missing assets and never silently overwrites a
conflicting one. If npm succeeded and attachment failed, rerunning attachment
does not publish again. If attachment succeeded and npm failed, fix the npm
trusted publisher configuration and rerun the failed publication job.

## Package command inventory

| Command (`yarn ...`)             | Purpose                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `lint:ci`                        | Check source formatting and ESLint without edits.                                                                                           |
| `lint`, `prettier`               | Local formatting/fixing commands; not used for CI validation.                                                                               |
| `test`, `test:watch`, `test:cov` | Jest once, interactively, or with coverage.                                                                                                 |
| `test:package`                   | Packaging contract regression tests.                                                                                                        |
| `test:maintenance`               | Fast cleanup and command-argument checks using temporary fixtures; does not clean this checkout.                                            |
| `test:release`                   | Offline tests of release identity, archive integrity, registry retry behavior, and attachment retries; never publishes.                     |
| `build`, `build:watch`           | Development bundle and declarations in `dist/`.                                                                                             |
| `build:prod`, `build:prod:watch` | Production bundle and declarations in `dist-prod/`.                                                                                         |
| `pack:release`                   | Fresh production build, explicit npm staging, exact-archive verification, and a versioned release receipt.                                  |
| `pack:preview`                   | Same production packaging path with a unique private local preview version.                                                                 |
| `verify:package`                 | Verify an already-built npm archive through isolated runtime and declaration consumers.                                                     |
| `examples:check`, `svg:check`    | Type-check standalone generators and SVG tooling.                                                                                           |
| `generate:*`                     | Build proportion, Ulam, primes, memory-piers, or rainbow `.parsegraph` fixtures under `generated/`; see `package.json` for format variants. |
| `svg:build`, `render:svg`        | Build the browser renderer or export a document using locally installed Chrome/Chromium. Browser exports are not run in CI.                 |
| `doc`                            | TypeDoc output in `dist/docs/`.                                                                                                             |
| `dependencygraph`                | Generate `dependencygraph.svg`; requires external `ts_dependency_graph` and Graphviz.                                                       |
| `tar`, `tar:prod`                | Compatibility commands; use `pack:preview` / `pack:release` for installable consumer packages.                                              |
| `all`                            | Check-only lint, Jest coverage, development build, and API docs; source formatting is not changed.                                          |
| `clean`                          | Remove the JavaScript build/staging outputs and generated artifacts listed below. CI starts from a fresh checkout.                          |

### Local maintenance

`yarn lint:ci` checks formatting and lint without changing files. `yarn lint`
formats source and applies ESLint fixes; `yarn prettier` only formats source.
Both lint commands pass quoted recursive and exclusion patterns to the installed
ESLint. `yarn all` uses the check-only command, so validation cannot silently fix
source files.

`yarn clean` removes `dist/` (including generated API docs and coverage),
`dist-prod/`, `dist-types/`, `dist-tools/`, and the legacy `parsegraph/` staging
directory. It also removes the root `parsegraph-dev.tgz`, `parsegraph.tgz`, and
`dependencygraph.svg` artifacts. Within `generated/`, it removes only direct
`.parsegraph`, `.svg`, `.png`, and `.tgz` files, the preview/release package
receipts, and `SHA256SUMS`. Save any generated files you want to retain elsewhere
before cleaning.

The command resolves its checkout from the script's location, independent of the
working directory. It preserves `generated/README.md`, other unknown files and
subdirectories, authored `docs/`, `examples/fixtures/`, installed dependencies,
editor settings, and native build directories. A symlinked `generated/`
directory is rejected before cleanup; artifact symlinks are unlinked without
following their targets. The command accepts no output-path arguments.

Run `yarn test:maintenance` to verify cleanup and lint command behavior using
temporary directories. It does not remove files from your working checkout.

The `deploy` and broken `deploy:prod` package commands are removed. Registry
publication is owned by the release workflow, independently of the VPN website
push-to-deploy hook and eventual EC2 production deployment.
