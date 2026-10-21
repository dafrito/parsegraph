# Static SVG exporter

Turn a `.parsegraph` document into a standalone SVG image. This is the first
reference renderer: it measures content, runs the layout algorithm, and draws
the resulting graph. It has no editing, event handlers, or debugging overlays.
Open the SVG in a browser, embed it in a website, or use it as a thumbnail.

## Usage

Install the repository dependencies and have Chrome or Chromium installed:

```sh
yarn generate:ulam
yarn render:svg generated/ulam.parsegraph

yarn generate:proportion:v1
yarn render:svg generated/proportion-v1.parsegraph

yarn render:svg generated/ulam.parsegraph --width 320 --output generated/ulam-thumb.svg
```

The default output is beside the input, replacing `.parsegraph` with `.svg`.
The default width is 1200; height follows the graph's aspect ratio. `--height`
alone derives width. Specifying both dimensions fits the whole graph into that
viewport without stretching it. `--padding` sets the margin in graph units
(default 16), before scaling to the output dimensions.

Chrome is discovered in common macOS locations and on `PATH`, with additional
Windows installation locations checked. Use `--browser /path/to/chrome` or
`PARSEGRAPH_CHROME` to choose it explicitly. Each export launches headless Chrome
with an isolated temporary profile, which is removed afterward. No browser
download, account, server, or network font service is required.

`yarn render:svg` builds the browser renderer before exporting. For repeated
exports or clean SVG on stdout, build once and invoke the CLI directly:

```sh
yarn svg:build
./node_modules/.bin/ts-node --project tools/svg/tsconfig.json tools/svg/cli.ts generated/ulam.parsegraph --output - > generated/ulam-copy.svg
```

The standalone renderer bundle is in ignored `dist-tools/svg/`. It is tooling;
the published layout library does not acquire a browser dependency.

## Content and presentation

- Reads legacy v0 and [v1 documents](../../docs/parsegraph-v1.md).
- Honors `presentation/1`, including square nodes, minimum sizes, spacing,
  proportional vertical steps, text settings, and per-node style assignments.
- Renders string and numeric values as literal multiline text. Missing values
  have no label. Other JSON values require an application-specific content
  adapter and currently produce an error instead of an invented rendering.
- Ignores unknown capabilities and reports their names on stderr.
- Honors optional `appearance/1` for node fill, border, text, outgoing connector
  colors/alpha, and page background. See [the contract](../../docs/appearance-v1.md).
- Without presentation rules, uses the standard preset: missing values get the
  bud style; labeled nodes, including empty strings, get the block style. This
  is a fallback, not a promise of pixel parity with legacy Freeform.

Without `appearance/1`, the exporter owns its palette: `block` is green, `slot` is near-white, `bud` is
pale yellow, and other styles are gray. Borders and connectors are also renderer
conventions; colors are not new fields in `presentation/1`. Ulam uses block/slot
assignments to distinguish primes from non-primes.

Canvas measures labels with installed browser fonts before layout. SVG text uses
the same font request and measured advance widths. Fonts are not embedded or
converted to paths: glyph appearance can differ on another machine, and font
availability can change geometry when regenerating an image. Pin browser and
fonts when reproducible images matter.

The image contains rectangles and text, not a raster screenshot. Thumbnail
dimensions scale the same complete drawing; they do not simplify the graph or
reduce its element count. Large graphs therefore still produce large SVG files.
PNG output, level-of-detail rules, navigation controls, and layout diagnostics
are future work. The CLI currently allows 30 seconds for layout and 45 seconds
for the browser process.

## Verification

```sh
yarn svg:check
yarn examples:check
yarn test --runInBand tools/svg/render.spec.js
```

The tests use deterministic font metrics to check scaled paint groups, inward
connector layering, literal text, legacy imports, capability handling, and Ulam
prime roles. Actual Chrome exports exercise the installed font engine; visual
inspection of those exports complements these geometry tests.
