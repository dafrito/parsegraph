# Freeform v1 package handoff

Parsegraph 7 contains the document APIs used by Freeform. The old registry
package `parsegraph@6.2.0` predates them. Freeform's initial integration used a
local preview; after publication, use the registry release so clean checkouts
and CI do not depend on a sibling repository.

## Use the published release

After `parsegraph@7.1.0` is available on npm, run in Freeform:

```sh
yarn add --exact parsegraph@7.1.0
```

Commit the dependency and lockfile together. Verify a clean dependency install,
the Freeform test suite, and its production build. Preserve any unrelated work
in progress. The package can be verified before publication by installing the
exact archive from `yarn pack:release` into an isolated Freeform checkout.

The npm package version is independent of the `.parsegraph` document version,
which remains v1, and of capability versions such as `appearance/1`.

## Build and install the preview

From the Parsegraph repository:

```sh
yarn pack:preview
cat generated/preview-package.json
```

This builds production code and creates
`generated/parsegraph-7.1.0-v1.local.<content-hash>.tgz`. The receipt records the
exact filename, version, and npm integrity value. The preview is marked private,
has no install scripts, and is not published. Its version is a local identity
derived from the source package version and packaged contents. The source
manifest and lockfile are not changed by packaging.

In Freeform, install the **exact filename from that receipt**:

```sh
yarn add file:../parsegraph/generated/parsegraph-7.1.0-v1.local.<content-hash>.tgz
```

Replace `<content-hash>` before running that command; it is not a literal path.
Commit Freeform's dependency/lockfile change together with its migration when
ready. A sibling local file dependency is for this coordinated local work; CI
and other machines need access to the same artifact or a later published build.
Avoid copying files into `node_modules`, which leaves the lockfile inaccurate.

The tarball contains runtime code and declarations, source/reference examples,
the v1 and generation specs, and the three geometry fixtures. Import public APIs
from `parsegraph` normally; there is no need to import TypeScript source paths.
The included example sources are references, not installed package commands.

Both release and preview pack commands use the same file contract. The pack
command extracts its own tarball and checks v1 exports, v0 loading,
unknown-capability and metadata preservation, and all three fixtures with the
six-units-per-code-point text metric and `1e-5` tolerance. This validates the
package boundary, not Freeform's rendering or persistence implementation. It
also compiles a strict isolated TypeScript consumer without ambient repository
types and checks the browser UMD entry point. Consumers receive no build or
install scripts; declaration maps are omitted and runtime maps embed sources.

## Migration order

1. **Preserve documents.** Store root plus capabilities and metadata through
   import, save, browser persistence, undo, and redo. Use
   `deserializeParsegraphDocument` and `serializeParsegraphDocument`. Keep
   camera/selection in the application's `metadata.freeform` convention.
2. **Apply presentation.** Update both sizing/separation and text rendering for
   `presentation/1`; preserve the current v0 rendering path. Use
   `createTextMeasurer` and `createPresentationPainter` as shared helpers where
   appropriate. Custom styles such as `slider` are static geometry.
3. **Verify Freeform.** Run the geometry fixtures, then the demo/edit/save checks
   in [the main spec](parsegraph-v1.md#6-freeform-migration-checklist).

`generation/1` remains opaque during this migration. Preserve it through edits
and history; never regenerate a graph just because its recipe is present.
The PRNG happens to match Freeform's seeded examples, but a seed alone does not
identify a generator or its revision.

## Builder colors and appearance

The optional [`appearance/1` capability](appearance-v1.md) is now implemented in
this checkout and the SVG exporter. It maps Freeform's existing node color/alpha
fields and page background into a portable payload. That specification includes
the builder findings, exact migration mapping, and an acceptance fixture.

Export complete effective defaults plus sparse per-node overrides. Preserve
appearance alongside presentation through document storage and history. Omit
the capability when no portable color specification is needed. Supporting it
does not require adding color fields to `presentation/1`, and old v0 viewport
styling remains supported through the existing path.

The earlier `897be06e901295aa` preview predates appearance support. Install the
latest exact filename from `generated/preview-package.json` for the new
`loaded.appearance`, writer shorthand, validation, and `resolveNodeAppearance`
API. Border widths and corner shapes are not included in appearance/1.

The standalone rainbow port is an end-to-end appearance PoC:
`yarn generate:rainbow --count 8` writes `generated/rainbow.parsegraph`, and
`yarn render:svg generated/rainbow.parsegraph` produces a reference image.
It uses Freeform's existing color calculations and resolved default colors.

## Optional focus capability

[focus/1](focus-v1.md) adds node framing intent without changing layout. The new
library restores it on nodes and derives it from current nodes on v1 export.
A viewer can call `node.layout().focusBounds(...fallbackDirections)` after
layout to frame selected child branches without sibling continuations. Until
camera integration is implemented, preserve the capability and retain existing
framing behavior. This API is included in 7.1.0; consumers remaining on 7.0.1
should continue treating it as opaque data.

## Optional separation capability

[separation/1](separation-v1.md) is included in 7.1.0. It preserves directional
loose separation independently of node fit. Use `caret.pull("d")` followed by
`caret.loosen()` for vertical content with loosely separated horizontal buds;
`caret.tighten()` restores exact separation on the current perpendicular axis.
These actions retain exact node extents when node fit is EXACT.

Inward-contained roots now preserve vertical pull correctly in TypeScript and C.
This can change geometry for existing inward graphs affected by the old bug.
Check those graphs, focus framing, and separation persistence when adopting
7.1.0; upgrading the dependency alone does not add viewer camera behavior.
