# Parsegraph documents: v1 draft and capability specification

**Status: working draft, implemented in this checkout; not a published stable
interchange standard.** Freeform has not yet adopted this format. This document
is intended to be sufficient for that implementation without reading the
TypeScript helper. Fixtures and migration instructions appear below.

**Freeform handoff:** start with section 6. This specification covers the current
proportion, Ulam, primes, Memory Piers, and rainbow generators. The related
[`generation/1` specification](generation-v1.md) describes embedded seeds;
Freeform can preserve that payload without implementing regeneration.
The optional [`appearance/1` specification](appearance-v1.md) defines portable
colors and alpha, including Freeform's existing builder styling.

The existing unversioned format is called **v0**, including its current quirks.
[Its description](../SERIALIZATION.md) remains the compatibility reference.

## 1. Compatibility model

`version` identifies the core document envelope and graph representation.
Capabilities describe additional, independently interpretable behavior. Adding
a capability does not change the envelope version.

Readers **must accept unknown capabilities** when the core graph is valid. They
may ignore those capabilities and render using their supported features and
local defaults. Appearance and behavior can therefore differ across readers.
Readers should expose which capabilities were ignored without blocking opening
the graph. Editors must retain unknown capability payloads on ordinary save.
There is no required-capability list or negotiation gate in this draft.

A known capability must be validated before use. A malformed supported payload
is an error, rather than an instruction to silently use defaults. An unknown
capability's contents are opaque JSON and must not be partially interpreted.
Unknown fields inside the defined core, `presentation/1`, or `appearance/1` are rejected: new
behavior belongs in a new capability payload, not an unannounced field that
looks supported. Unknown names in the capability map itself are accepted.

Changing an existing capability's meaning incompatibly requires a new identifier
(for example, `presentation/2`). An unrelated feature can use its own identifier
while the file remains v1. Readers apply only versions they support; overlapping
future capabilities must define their precedence before standardization. During
this draft phase, definitions and fixtures may still be revised together.

## 2. Encoding and envelope

Files use UTF-8 JSON and conventionally the `.parsegraph` extension. A v1 document
has these fields; all are required except `metadata`:

| Field | Type | Meaning |
| --- | --- | --- |
| `format` | String | Exactly `"parsegraph"`. |
| `version` | Number | Exactly `1`, not the string `"1"`. |
| `root` | Nonempty string | ID of the unique root. |
| `nodes` | Nonempty array | Node records, in any order. |
| `capabilities` | Object | Capability identifiers mapped to JSON payloads; `{}` is valid. |
| `metadata` | Object, optional | Namespaced, opaque application annotations. Readers preserve these without needing to interpret them. |

Capability identifiers must be nonempty strings. For dual-format detection,
the reference reader treats an own `format` or `version` property with a scalar
value (including `null`) as a versioned envelope marker, then validates the
whole envelope. It must not fall back to v0 after a versioned-document validation
error. Bare v0 maps may have nodes named `format` or `version` whose values are
node-record objects; the presence of those keys alone does not imply v1.

Minimal complete example:

```json
{
  "format": "parsegraph",
  "version": 1,
  "root": "root",
  "nodes": [
    {
      "id": "root",
      "value": "Hello",
      "scale": 1,
      "fit": "loose",
      "layoutPreference": "horizontal",
      "parentId": null,
      "parentDir": null,
      "alignment": "none",
      "axisOverlap": "default",
      "rightToLeft": false,
      "paintGroup": false
    }
  ],
  "capabilities": {}
}
```

JSON values must be finite and acyclic, with no functions, undefined properties,
or custom object conversion. The reference implementation limits JSON nesting to
100 levels; the graph's parent-child depth is independent of JSON nesting.
Duplicate JSON object member names must not be emitted. The reference loader
accepts parsed objects and cannot detect duplicates already discarded by
`JSON.parse`; duplicate node IDs remain detectable because nodes are an array.

Metadata must not be necessary to interpret the core graph. For example,
`metadata.freeform` can hold camera and selection state. Sizing or spacing
behavior belongs in a capability. No URLs, paths, or strings in a payload imply
code execution or automatic fetching.

## 3. Node records

All fields are required except `value`. IDs are strings, including IDs that look
numeric. Implementations must treat them as opaque map keys, including names
such as `__proto__`; use safe maps rather than inherited-property lookups.

| Field | Type / accepted values | Meaning |
| --- | --- | --- |
| `id` | Unique nonempty string | Node identity; stable IDs are recommended. |
| `value` | Any JSON value, optional | Application-defined content. Missing, `null`, and `""` are distinct. |
| `scale` | Finite number greater than zero | Node's scale relative to its parent. |
| `fit` | `exact`, `loose`, `naive` | Fitting mode. |
| `layoutPreference` | `parent`, `perpendicular`, `horizontal`, `vertical` | Axis preference; roots use only horizontal or vertical. |
| `parentId` | String or `null` | Parent's ID; `null` only for the root. |
| `parentDir` | Direction string or `null` | Direction **from the child toward its parent**. |
| `alignment` | `none`, `negative`, `center`, `positive`, `inward-horizontal`, `inward-vertical` | Alignment of the parent's connection to this child. Root uses `none`. |
| `axisOverlap` | `allowed`, `prevented`, `default` | Overlap setting for the parent's connection to this child. Root uses `default`. |
| `rightToLeft` | Boolean | Node's layout-direction setting; distinct from text shaping direction. |
| `paintGroup` | Boolean | Whether the node has an **explicit** group boundary. The root always forms a group even when this is false. |

Directions are `inward`, `outward`, `downward`, `upward`, `forward`, `backward`.
Reverse pairs are inward/outward, downward/upward, forward/backward.
An ordinary forward child stores `parentDir: "backward"`. An inward child stores
`parentDir: "outward"`. `parentDir: "inward"` is invalid for a non-root because it
would require spawning an outward child. The root uses `parentDir: null`.

Containment children (`parentDir: "outward"`) use `none`, `inward-horizontal`, or
`inward-vertical`; `none` uses horizontal containment. Other children use only
`none`, `negative`, `center`, or `positive`. Inward/outward describe containment,
not a third spatial layout axis.

Before constructing connections, readers must validate:

1. Exactly one root exists and its ID equals the envelope's `root`.
2. IDs are unique; every non-root parent exists and differs from the child.
3. Reversing each child's `parentDir` gives an unoccupied direction on its parent.
4. That direction does not conflict with the parent's own parent connection.
5. Every node is reachable from the declared root, and there are no cycles.
6. Fields have the listed types and enum values; numeric enum ordinals are invalid.

The format describes existing connections. Settings for currently unconnected
neighbor slots, caret stacks, computed positions, and layout caches are not
stored. These are not arbitrary edge-list graphs. Right-to-left, overlap, and
explicit root grouping are preserved, unlike v0's omissions.
Node-array order has no semantic meaning and may change on save as traversal
bookkeeping is rebuilt. Compare node records by ID when checking round trips.

## 4. Capability `presentation/1`

This capability supplies geometry-related presentation rules. It does not
replace `value` or define a styling language with selectors or executable rules.
All values below are explicit: readers must not merge in their own preset.

Example payload, placed at `capabilities["presentation/1"]`:

```json
{
  "text": { "fontFamily": "sans-serif", "fontSize": 10, "lineHeight": 10 },
  "styles": {
    "block": { "minWidth": 10, "minHeight": 15, "paddingX": 3, "paddingY": 2.5, "square": false },
    "bud": { "minWidth": 7.5, "minHeight": 7.5, "paddingX": 0, "paddingY": 0, "square": false }
  },
  "defaultStyle": "block",
  "nodeStyles": { "root": "block" },
  "spacing": { "horizontal": 5, "vertical": 5, "inward": 5, "verticalStep": 20 }
}
```

All top-level payload fields are required. `styles` is a nonempty map from
nonempty style names to records. `defaultStyle` must name one of them. Entries
in `nodeStyles` must reference existing node IDs and existing styles. A node's
explicit style wins; otherwise use `defaultStyle`. Do not infer a style from
its value. Style names have no inherent meaning: `bud`, `block`, and `slot` are
generator conventions.

Dimensions, padding, and gaps must be finite nonnegative numbers. Font size and
line height must be finite positive numbers. Font family must be a nonblank
string; `square` must be boolean. All style fields shown above are required.
The spacing fields horizontal, vertical, and inward are required. `verticalStep`
is optional and, when present, must be finite and greater than zero.

### 4.1 Content measurement

Units are logical layout units before node scale and camera transforms. Browser
adapters can use CSS pixels as the corresponding font-measurement unit; device
pixel ratio must not alter layout dimensions.

For standard text content:

- Missing `value` has content size `(0, 0)` and no label.
- Strings are literal text, not HTML or markup. Normalize CRLF and CR to LF,
  then split on LF, retaining empty and trailing lines. Do not wrap or trim.
- Finite numbers use their JSON textual representation (including `-0` becoming
  `0`), then follow the string rules.
- Measure each complete line using the requested font family, font size, and
  normal weight/style. Content width is the maximum line width. Content height
  is the line count multiplied by `lineHeight`.
- An empty string is one empty line; it therefore has positive content height.
- Objects, arrays, booleans, and `null` remain valid values but have no standard
  text interpretation here. A viewer may supply its own content adapter or show
  an unsupported-content placeholder. It must not assume an object's `label`
  property has special meaning. Such fallback is not presentation conformance
  for that node.

Font fallback is permitted. Readers should indicate substitutions if exact
appearance matters. Different available fonts or shaping engines can produce
different geometry; this capability alone does not promise pixel identity.
Layout comparison tests must use identical measured content dimensions.

### 4.2 Body sizing and containment

Let measured content dimensions be `(cw, ch)`. If there is an inward child, get
that child's laid-out extent dimensions multiplied by its scale, `(iw, ih)`.
With gap `g = spacing.inward`, combine them before applying padding:

- Vertical containment: `cw = max(cw, iw)`; `ch = ch + ih + g`.
- Horizontal containment: `cw = cw + iw + g`; `ch = max(ch, ih)`.

The gap applies even when there is no label. Compute the node body:

```text
width  = max(minWidth,  cw + 2 * paddingX)
height = max(minHeight, ch + 2 * paddingY)
if square: width = height = max(width, height)
```

Border decoration must fit inside these body bounds; do not add a separate
border-size term. Square means each node's body is square, not that all nodes
have equal sizes. These rules define geometry; label placement, colors, line
thickness, selection effects, and culling remain viewer concerns. Viewers should
use the same measurement rules when drawing labels.

### 4.3 Separation and shared vertical step

The sizing adapter returns `spacing.horizontal`, `spacing.vertical`, or
`spacing.inward` from the corresponding layout separation callback. These are
minimum separation inputs; graph extents and alignment can require more room.
Zero minimum gap does not guarantee touching bodies in a branched graph.

For vertical connections only, `verticalStep` raises the returned gap when
necessary. Let `hp` be the parent's unscaled body height, `hc` the child's
unscaled body height, `s` the child's relative scale, and `t` the requested step:

```text
returnedGap = max(spacing.vertical, (t - hp/2 - hc*s/2) / s)
```

The current algorithm multiplies this returned gap by `s` when separating
cardinal neighbors. Thus `t` is expressed in the parent's local coordinates.
The rule is a minimum center-to-center step for body-only separation, not a
global alignment constraint. Larger bodies, branches, and extent interactions
can increase the actual separation. It never shrinks a gap or permits overlap
to force a step. Horizontal and containment connections are unaffected.

This rule restores the proportion example's common baseline when the spine
blocks and branch buds fit within the chosen step. It captures the original
relationship without requiring viewers to recognize that particular example.

### 4.4 Convenience presets

`createPresentation` supplies three presets. Their names are not serialized;
the resolved rules are. All use `sans-serif`, font size 10, and line height 10.
`defaultStyle` is `block`; `nodeStyles` starts empty.

| Style | Minimum width/height | Padding X/Y |
| --- | --- | --- |
| block | 10 / 15 | 3 / 2.5 |
| slot | 10 / 15 | 3 / 2.5 |
| bud | 7.5 / 7.5 | 0 / 0 |

| Preset | Square bodies | Horizontal/vertical/inward gaps | Vertical step |
| --- | --- | --- | --- |
| standard | No | 5 / 5 / 5 | Absent |
| proportional | No | 5 / 5 / 5 | 20 |
| math | Yes | 0 / 0 / 0 | Absent |

These are new explicit conventions, not pixel-identical recreations of every
historical graph-js style. A generator must assign bud/slot roles in `nodeStyles`
if it wants those styles; missing content alone does not select a bud style.

Generators can customize any resolved preset field. Ulam and primes use math
rules with larger, equal minimum dimensions for blocks and slots so empty and
labeled cells align. Honor the serialized dimensions rather than recreating a
local "math mode" from the preset table. Square bodies alone do not guarantee
a uniform grid; labels wider than the minima can still enlarge individual cells.

### 4.5 Custom styles and static controls

Readers must accept arbitrary valid style names, not only the three names used
by the convenience presets. A custom style uses the same sizing and separation
rules as any other style. Its name does not require a corresponding widget.

Memory Piers supplies a `slider` style with `minWidth: 320`, `minHeight: 15`,
`paddingX: 1.25`, `paddingY: 1.25`, and `square: false`. Its nodes have an empty
string value. This currently represents a wide static body: no slider value,
range, thumb position, drag behavior, or event binding is serialized. Freeform
should render its defined geometry without requiring an interactive slider.

Without `appearance/1`, the reference SVG exporter colors block/slot/bud styles green/near-white/yellow
and custom styles gray. This palette is an exporter convention, not a required
part of presentation conformance. Freeform may use its own decoration, provided
it respects the body's dimensions and uses compatible text measurement.

## 5. Reference API and capability preservation

The optional [`generation/1` capability](generation-v1.md) records a generator
recipe, including its random seed and algorithm. It does not affect rendering;
the core reader preserves it as an opaque capability.

```ts
const document = serializeParsegraphDocument(root, {
  presentation: createPresentation("proportional"),
  capabilities: { "example/annotations/1": { note: "retained by unaware readers" } },
  metadata: { freeform: { selectedNode: "root" } }
});

const loaded = deserializeParsegraphDocument(document);
// loaded.root, loaded.presentation (optional), loaded.capabilities,
// loaded.ignoredCapabilities, loaded.metadata, loaded.version

// Preserve unknown capabilities and metadata while saving the current graph.
const saved = serializeParsegraphDocument(loaded.root, loaded);
```

`presentation` in the writer options is shorthand for adding or replacing the
`presentation/1` payload. Without it, supplied capability payloads are retained;
with no options, the writer emits an empty capability map. The writer validates
and snapshots JSON data. The reader validates before graph mutation and copies
payloads. It reports unsupported capability names but does not reject them.

The reference library currently validates/interprets `presentation/1` and `appearance/1`; it only
preserves `generation/1` and other unknown capabilities as opaque JSON.
`ignoredCapabilities` therefore reports what the library does not interpret,
not necessarily what the host viewer implements. If Freeform initially uses
local sizing instead of `loaded.presentation`, it should also disclose that
presentation is not being applied. Conversely, merely recognizing the
`generation/1` name does not require implementing its recipe semantics.

When content or topology is edited, supported capabilities referencing node IDs
must be updated as needed (for example, remove styles for deleted nodes).
This includes both presentation assignments and appearance overrides.
Unknown payloads are retained as opaque data; they may become stale after edits,
which a viewer cannot repair without understanding them. Converting to v0 is an
explicit lossy export and does not preserve capabilities.

The legacy `serializeParsegraph` continues writing v0. The legacy
`deserializeParsegraph` rejects a recognized versioned envelope and directs
callers to the document API; this avoids accidentally discarding capabilities
through an API that returns only a root node. The document loader reads wrapped
or bare v0 using existing behavior and reports version 0 with no capabilities.
Unknown core versions still require an appropriate reader; unknown capabilities
within v1 do not.

## 6. Freeform migration checklist

1. Update to a library build exposing the document APIs, or implement sections
   1–3 locally. Detect the v1 envelope separately from wrapped/bare v0.
2. Keep the whole loaded document state, including unsupported capabilities and
   metadata. Replace graph-only import/export, persistence, and undo snapshots
   where they would discard that state.
3. Initially, opening v1 with local presentation defaults is acceptable. Report
   ignored capabilities as information, not a blocking error.
4. To support `presentation/1`, use its text policy for labels and its sizing and
   separation rules in `LayoutPainter`. The exported `createTextMeasurer` and
   `createPresentationPainter` can provide these callbacks without graphics
   dependencies. Freeform must update both measurement and glyph rendering:
   changing only the layout callback leaves text drawn with mismatched metrics.
5. Preserve v0 appearance using the existing v0 sizing path. Do not silently
   apply the new presets to old documents. V0 style/camera metadata lives outside
   the core node map; preserve it through the existing v0 path.
6. Define v1 camera/selection annotations under `metadata.freeform`; that is an
   application convention, not required for viewing the graph. Keep diagnostic
   colors or selection highlighting separate from document geometry.
7. Preserve ignored capability payloads and metadata on v1 save. Keep explicit
   v0 export available with a clear indication that newer information is lost.
8. Verify the fixtures below and a v1 round trip containing an unknown capability.

For this handoff, implementing `presentation/1` is the milestone that lets these
demos retain their intended geometry in Freeform. Opening and preserving the
envelope alone is useful incremental progress, but will still show differences
such as staggered proportion endpoints and missing math/slider sizing.

The APIs described here are implemented in this checkout and exported from
`src/index.ts`; this work has not been published as a new npm release. Use a
build of this checkout or port the specified behavior. Do not assume that an
existing installed `parsegraph` dependency exposes these APIs.
The [local package handoff](freeform-handoff.md) provides an installable,
distinctly versioned preview and package-level fixture checks.

When adding nodes, use unique nonempty string IDs; the v1 serializer validates
IDs and does not coerce numeric IDs into strings. When deleting or renaming
nodes, remove or remap their `presentation/1.nodeStyles` entries so the next
save remains valid. Keep unused style definitions if desired. New nodes without
an explicit assignment use `defaultStyle`, including nodes with missing values.

Old Freeform builds do not understand this new envelope. Retaining the v0
generator command is the compatibility path until the migration is complete.

## 7. Fixtures and conformance checks

[Fixtures](../examples/fixtures/README.md) provide three 25-node versions of the
proportion graph and expected body geometry, one for each preset. Tests use a
deterministic text metric: each Unicode code point is six units wide, with the
document's line-height rule. This is a test metric, not a required production
font. Compare body widths/heights and absolute x/y positions; the proportional
fixture's numbered endpoints must share a baseline. Use a tolerance of `1e-5`
for numeric comparisons across implementations.

The TypeScript suite also covers malformed graphs, arbitrary JSON content,
capability preservation, round trips, scaled vertical steps, and containment.
These fixtures check layout/geometry interoperability, not raster pixel output.

Generate a larger file with:

```sh
yarn generate:proportion:v1
yarn generate:proportion:v1 --presentation math --output generated/proportion-math-v1.parsegraph
```

### 7.1 Current demo acceptance checks

From this repository root, generate small files for Freeform:

```sh
yarn generate:proportion:v1 --count 3
yarn generate:ulam --count 8
yarn generate:primes --count 30
yarn generate:memory-piers --count 4 --seed 42
yarn generate:rainbow --count 8
```

Outputs are under `generated/` and are ignored by Git; rerun these commands in
a fresh checkout. These commands overwrite the corresponding default generated
files. The [generator guide](../examples/README.md) documents `--output` for
separate filenames. For visual comparison, render any file with:

```sh
yarn render:svg generated/memory-piers.parsegraph
```

The [SVG exporter](../tools/svg/README.md) requires locally installed
Chrome/Chromium and uses installed fonts. Compare topology and geometry with
matching fonts; colors need not match.

| Example | What to verify in Freeform |
| --- | --- |
| Proportion | Numbered branch endpoints share a baseline with the proportional rules. |
| Ulam | Square cells, zero minimum gaps, and preserved block/slot assignments; 1 is a slot, not a prime. |
| Primes | Number line with upward prime-divisor columns; empty slots remain full cells and prime rows align. |
| Memory Piers | Alternating columns, wide static slider bodies, and intact `generation/1` seed/recipe after save and reload. |
| Rainbow | Per-node colors and alpha, translucent uncolored buds, and the dark page background from `appearance/1`. |

Also check edit/save/undo/redo: preserve metadata and an opaque future capability,
clean up style references after deletion, keep IDs consistent, and confirm that
explicit v0 export is the only intended path that discards v1 capabilities.
Generation recipes may become stale after editing; preserving one must never
cause the edited graph to be silently regenerated or replaced.

## 8. Deliberate boundaries

This draft does not define remote events, streaming patches, resource fetching,
rich-content rendering, a theme/selector language, or a computed-geometry snapshot format.
Optional concrete colors and alpha are defined separately by `appearance/1`.
Those can be separate capabilities. Presentation can improve across viewers
without making all viewers mandatory implementations of every feature.
