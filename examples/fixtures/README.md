# V1 interoperability fixtures

These committed fixtures accompany the [v1 draft](../../docs/parsegraph-v1.md).
Each `proportion-*.parsegraph` is the three-row proportion example (25 nodes). Its sibling
`.geometry.json` maps node IDs to expected absolute `x`/`y` positions and local
body `width`/`height` after layout.

Use the `presentation/1` rules in each file. For deterministic text measurement,
each Unicode code point has width 6; apply the specified newline and line-height
rules. This synthetic metric avoids system font differences. All scales in
these fixtures are 1. Compare numbers within `1e-5` across implementations.

- `standard`: distinct bud/block sizes and constant minimum gaps; endpoints stagger.
- `proportional`: shared vertical step; all numbered endpoints share one baseline.
- `math`: square bodies, zero minimum gaps.

The tests in `src/document/document.spec.ts` load these files and check their
expected geometry. Runtime-generated larger examples belong in `generated/`;
these small fixtures are intentionally tracked for independent consumers.

`appearance-colors.parsegraph` is a separate three-node fixture for optional
[appearance/1](../../docs/appearance-v1.md). It demonstrates default colors,
per-node overrides, separate alpha channels, and parent-owned connector color.
It has no geometry golden file; appearance must not change layout geometry.
