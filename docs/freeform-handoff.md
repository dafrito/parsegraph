# Freeform v1 migration: local package handoff

Freeform's installed registry `parsegraph@6.2.0` does not contain these document
APIs. This checkout still has that source package version; do not use it alone
to determine API availability.

## Build and install the preview

From the Parsegraph repository:

```sh
yarn pack:preview
cat generated/preview-package.json
```

This builds production code and creates
`generated/parsegraph-6.2.0-v1.local.<content-hash>.tgz`. The receipt records the
exact filename, version, and npm integrity value. The preview is marked private,
has no install scripts, and is not published. Its version is a local identity,
not a decision about the eventual public release number. The source manifest
and lockfile are not changed by packaging.

In Freeform, install the **exact filename from that receipt**:

```sh
yarn add file:../parsegraph/generated/parsegraph-6.2.0-v1.local.<content-hash>.tgz
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

The pack command extracts its own tarball and checks v1 exports, v0 loading,
unknown-capability and metadata preservation, and all three fixtures with the
six-units-per-code-point text metric and `1e-5` tolerance. This validates the
package boundary, not Freeform's rendering or persistence implementation.

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
