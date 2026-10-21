# Generated graphs

This directory holds generated `.parsegraph` files and exported images.
Graph files, SVGs, and PNGs are build outputs ignored by Git; this README keeps
the directory present in fresh checkouts.

Run `yarn generate:proportion` from the repository root to create
`proportion.parsegraph`. See [the generators](../examples/README.md) for options.

Run `yarn generate:ulam` followed by `yarn render:svg generated/ulam.parsegraph`
to create `ulam.svg`. See the [SVG exporter](../tools/svg/README.md). Current
Freeform builds need v0 files; the exporter reads both v0 and v1.
