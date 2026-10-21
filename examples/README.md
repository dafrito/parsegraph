# Graph generators

Each generator is a standalone TypeScript program that constructs a graph using
Parsegraph's public Node/Caret API and serializes it. Generators import the local
`src` entry point so they exercise the current checkout without requiring a
package build. No layout pass, text measurement, browser, or renderer is needed.

## Proportion example

From the repository root, after installing dependencies:

```sh
yarn generate:proportion
```

This writes `generated/proportion.parsegraph`, ready to open using Freeform's
Parsegraph file import. Change the number of rows with:

```sh
yarn generate:proportion --count 10
```

To select another output file:

```sh
yarn generate:proportion --count 50 --output generated/proportion-50.parsegraph
```

The script itself defaults to JSON on stdout. Invoke it directly when piping
output, avoiding package-manager status messages on stdout:

```sh
./node_modules/.bin/ts-node --project examples/tsconfig.json examples/generators/proportion.ts --count 10 > generated/proportion-10.parsegraph
```

The output directory exists in the checkout. The `--output` option also creates
missing parent directories. Diagnostics go to stderr. Generated `.parsegraph`
files are ignored by Git and can be recreated; the generator uses deterministic
node IDs. Type-check the examples with `yarn examples:check`.

### V1 documents and presentation

The default command still produces **v0** for existing Freeform builds. To emit
the new v1 draft with an explicit proportional presentation capability:

```sh
yarn generate:proportion:v1
yarn generate:proportion:v1 --presentation math --output generated/proportion-math-v1.parsegraph
```

Supported presets are `standard`, `proportional` (the v1 default), and `math`.
The proportional preset uses a shared minimum vertical step to compensate for
the different heights of buds and blocks. The math preset squares bodies and
uses zero minimum gaps. Resolved rules are stored in the document; viewers need
not know the preset name. `--presentation` requires `--format v1` when invoking
the script directly. See the [v1 specification](../docs/parsegraph-v1.md).

Freeform needs its v1 importer updated before opening these files; it can then
ignore capabilities until support is implemented. The current v0 viewer's
different block/bud spacing makes proportion endpoints stagger instead of
sharing the historical baseline. Preserving topology alone cannot preserve
presentation-dependent proportions.

### What the example demonstrates

Ported from `graph-js-pre-la-trip/src/widgets/showProportionTest.js`, this graph
has a descending spine, backward and forward branches that get progressively
shorter, numbered endpoints, and a small three-bud cap above the root. Each spine
node is pulled downward. The first downward bud on each side branch starts a
paint group, when such a bud exists.

The original's click handlers, carousel menus, glyph atlas, and style objects
belong to its application and are not included in this static graph. Missing
values represent buds; empty-string values represent unlabeled blocks; string
numbers label the endpoints. The old slot/block distinction has no dedicated
field in the core format, so endpoint appearance follows the viewer's styling.

The original source unconditionally overrides its count to 200 despite earlier
defaults and limits. This generator defaults to 30 and accepts integers from
1 to 200, including the original effective count. The graph contains
`count² + 4 × count + 4` nodes: 1,024 at the default, or 40,804 at 200. The upper
limit keeps this quadratic example bounded; it is not a library limit.

See [the serialization format](../SERIALIZATION.md) for the document contract
and current round-trip limitations. Freeform measures and lays out this graph
when opening it; this file contains no precomputed geometry.

## Ulam example

```sh
yarn generate:ulam
yarn render:svg generated/ulam.parsegraph
```

Ported from `graph-js-pre-la-trip/src/widgets/showUlam.js`. It follows the old
clockwise spiral with descending labels, preserving the blank starting node
and a paint group at each turn. The default count is 35: 1,190 numbered nodes
plus the blank root. `--count` accepts integers from 2 to 200.

This generator defaults to v1 with math presentation: square cells, zero gaps,
and minimum cell sizes chosen to accommodate the largest label. Prime numbers
use `block`; non-primes (including 1) use `slot`. The blank root also uses
`block`. The exporter supplies the colors; the generator performs no layout.

`yarn generate:ulam:v0` produces `generated/ulam-v0.parsegraph` for existing
Freeform builds, losing the math presentation and prime style assignments.
Both formats support `--count` and `--output`; the standalone script defaults
to JSON on stdout. See the [SVG exporter](../tools/svg/README.md) for thumbnails
and other image options.

## Primes example

```sh
yarn generate:primes
yarn render:svg generated/primes.parsegraph
yarn generate:primes --count 100 --output generated/primes-100.parsegraph
```

Ports the incremental `PrimesWidget` in
`graph-js-pre-la-trip/src/widgets/buildPrimesDemo.js` as a static snapshot.
`--count` is the largest number shown, inclusive (default 30, range 1–1000).
The original `buildPrimesDemo` wrapper only returned the initial root; this
generator also performs the widget's steps to populate the graph.

Numbers run forward from 1. Each number's upward column contains one cell for
each previously discovered prime: a labeled block when that prime divides the
number, otherwise an empty slot. A newly discovered prime adds its own labeled
cell at the top. These are distinct prime divisors, not a factorization with
multiplicity: 12 marks 2 and 3 once each. The initial 1 has no prime column.

The v1 math presentation uses square cells and zero gaps. Blocks and slots share
minimum dimensions sized for the largest label, keeping prime rows aligned
(as with Ulam, unusually wide fonts can still enlarge cells).
The original upward layout preference and paint-group
breaks (at the first existing-prime cell and every 250 thereafter) are retained.
The old advancing-multiple calculation is replaced with integer remainder;
click handlers and timers are omitted. Large counts produce many empty slots
and correspondingly large files and images.

`yarn generate:primes:v0` writes `generated/primes-v0.parsegraph` for legacy
Freeform, losing the block/slot presentation distinction. As with the other
generators, the standalone script defaults to JSON on stdout.

## Memory Piers

```sh
yarn generate:memory-piers --seed 42
yarn render:svg generated/memory-piers.parsegraph
yarn generate:memory-piers --count 8 --seed 123 --output generated/memory-piers-123.parsegraph
```

Ports `showMemoryBlocks.js`, used by the old `www/piers.html`. Columns alternate
above and below a horizontal spine, with randomly selected side blocks and
wide slider shapes. Sliders are static geometry here, with no interactive
behavior. Named styles retain the original shape proportions at a smaller
scale, using the current presentation spacing. Exact legacy pixel parity is
not implied. The SVG exporter draws the custom slider style in its gray palette.

`--count` controls both column count and length (default 12, range 1–200).
Without `--seed`, each run chooses a fresh unsigned 32-bit seed. The resolved
seed is printed on stderr and embedded in the v1 `generation/1` capability,
along with the PRNG, generator revision, and count. Reusing the recipe produces
the same graph, IDs, and presentation. See [the recipe contract](../docs/generation-v1.md).

`yarn generate:memory-piers:v0` is available for legacy consumers, but loses the
embedded recipe and style distinctions, including slider dimensions. The core
loader and SVG exporter may report `generation/1` as ignored; rendering uses
the stored graph, so no regeneration support is needed to view it.

## Rainbow (appearance proof of concept)

```sh
yarn generate:rainbow
yarn render:svg generated/rainbow.parsegraph
yarn generate:rainbow:vertical --count 8
yarn render:svg generated/rainbow-vertical.parsegraph
```

Ports Freeform's `buildRainbow` and its vertical variant. The default count is
20, matching Freeform: 8,421 unlabeled nodes, of which 8,000 receive explicit
opaque colors. `--count` accepts 2–30; the graph grows cubically. The original
trailing uncolored buds and group boundaries every eight outer steps are kept.

The generator uses the same pinned `parsegraph-color@1.5.1` implementation of
`fromLCH` and interpolation as Freeform. It is a development dependency for the
generator, not a runtime dependency of the layout library or exported files.
This preserves the existing example's calculations without claiming that its
color sampling is a calibrated color-space reference.

`appearance/1` carries the concrete per-node colors, Freeform's default
color/alpha fields, and the dark `#383838` page background. `presentation/1`
explicitly gives all nodes bud geometry. This is deterministic; no random seed
or regeneration capability is needed. The SVG consumes the exported colors
without knowing how they were calculated.

The standalone script supports `--output`, JSON on stdout, and optional
`--format v0`; that legacy export loses the colors and is not the PoC path.
