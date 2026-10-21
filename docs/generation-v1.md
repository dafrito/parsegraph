# `generation/1`: reproducible generator recipes

An optional `.parsegraph` v1 capability records how a static graph was generated:

```json
{
  "generator": { "name": "memory-piers", "revision": 1 },
  "random": { "algorithm": "lcg32/1", "seed": 42 },
  "parameters": { "count": 12 }
}
```

Place this object at `capabilities["generation/1"]`. It supplements the complete
serialized nodes; viewing the file never requires regenerating them. It does not
seed the layout algorithm or cause code execution, fetching, or live updates.

Consumers that interpret this capability must validate the following fields:

| Field | Meaning |
| --- | --- |
| `generator.name` | Nonempty identifier for a locally known generator. |
| `generator.revision` | Positive integer identifying its reproducible recipe. |
| `random.algorithm` | Nonempty identifier for the precise PRNG algorithm. |
| `random.seed` | Algorithm-specific seed; for `lcg32/1`, an integer from 0 through 4294967295. |
| `parameters` | JSON object of all inputs that affect generation. Its schema is generator-specific. |

These fields are required. Readers may preserve additional fields, but cannot
assume that an unknown generator, revision, or PRNG is reproducible using one
they do know. Reject unsupported recipes for regeneration, not for viewing.
The core loader and SVG exporter currently treat this capability as opaque:
they report it as ignored, and the document APIs preserve it on round-trip.

Identical inputs to the same generator revision must produce identical document
content, including IDs and presentation. Changes to random-call order, graph
construction, IDs, or presentation require a generator revision bump. Changes
to the PRNG require a new algorithm identifier. Keep the corresponding source
revision available if old recipes need to remain reproducible.

This is a record of the original generation, not proof that the graph is still
unmodified. Editing nodes may make it stale. Regeneration should be an explicit
operation producing a new document; it must not silently replace edits.

## `lcg32/1`

The unsigned 32-bit state starts at the seed, including seed zero. Before each
output, advance it with:

```text
state = (1664525 * state + 1013904223) mod 4294967296
output = state / 4294967296
```

The output is in `[0, 1)`. Multiplication uses integer arithmetic modulo 2³²;
the TypeScript implementation uses `Math.imul`, not an imprecise floating-point
product. This is a repeatable demo generator, not a security random source.

## `memory-piers`, revision 1

`parameters.count` is an integer from 1 through 200: both the number of columns
and the number of slots per column. The CLI defaults to 12. It chooses a fresh
32-bit seed unless `--seed` is supplied, prints that seed on stderr, and embeds
it in v1 output. The programmatic builders default to seed zero.

Each cell consumes three PRNG outputs in column-major order: the first is
discarded (the old demo's corresponding branches were identical), the second
adds a backward branch when `floor(output * 2) === 0`, and the third does the
same for a forward branch. Each branch contains a block with a downward slider.
Columns alternate downward/upward from the spine. Terminal buds, paint groups,
and layout preferences follow the original `showMemoryBlocks.js` demo.

Reproduce the example above with:

```sh
yarn generate:memory-piers --count 12 --seed 42
```

V0 export loses this capability and all presentation rules; the seed is still
printed so it can be retained separately. Font and renderer differences can
change exported images even when the generated `.parsegraph` is identical.
