# `appearance/1`: optional graph colors

**Implemented draft.** This independent capability carries Freeform's existing
color controls into v1. Omit it entirely when the viewer's palette is sufficient.
It does not require `presentation/1`, change geometry, or assign meaning to node
values or presentation style names.

Place this payload at `capabilities["appearance/1"]`:

```json
{
  "defaults": {
    "backgroundColor": "#d9f99d", "backgroundAlpha": 1,
    "borderColor": "#334155", "borderAlpha": 0.8,
    "textColor": "#0f172a", "textAlpha": 1,
    "lineColor": "#64748b", "lineAlpha": 0.6
  },
  "nodeStyles": {
    "child": { "backgroundColor": "#3366ff", "backgroundAlpha": 0.5 },
    "transparent": { "backgroundAlpha": 0 }
  },
  "pageBackgroundColor": "#f1f5f9",
  "pageBackgroundAlpha": 0.5
}
```

## Validation and resolution

All four top-level fields are required; unknown fields are rejected. `defaults`
must contain all eight fields shown above. `nodeStyles` is an object keyed by
existing node IDs, with any subset of those eight fields for each node; empty
overrides and an empty map are valid. Unknown fields and dangling IDs are errors.
IDs must be treated as opaque map keys, including `__proto__`.

Every color is a string of exactly `#` plus six hexadecimal digits (`#RRGGBB`,
case-insensitive), representing sRGB channels. No named colors, three/eight-digit
hex, CSS expressions, URLs, gradients, or `Color` class objects are accepted.
Alpha is an independent finite number in `[0, 1]`, not premultiplied into RGB.
Zero is valid and must not be replaced by a default through a truthiness check.

Resolve a node by copying `defaults` and overriding each field explicitly present
in its `nodeStyles` entry. A color-only override retains the default alpha; an
alpha-only override retains the default RGB. There is no parent inheritance,
CSS cascade, or lookup through `presentation/1.styles` or its style assignments.
Do not merge viewer palette fields into a supported appearance payload.

`lineColor`/`lineAlpha` apply to the outgoing cardinal connections drawn by that
node toward its children, matching `paintNodeLines(node, ...)`. The child's
line style does not recolor its incoming connection. Inward containment does
not acquire a connector. Background, border, and text alpha apply separately;
do not put one group opacity around the whole node. The page background uses its
own color and alpha; transparency must remain available to the host surface or
image embedding context.

Without this capability, viewers retain their defaults. A reader that does not
support it may ignore it and use local colors, while preserving its payload on
save. A supporting reader must reject malformed payloads. Borders, corner radii,
connector widths, selection/highlight overlays, and compositing order remain
viewer concerns. Decoration must continue to fit the presentation body bounds.

## APIs

```ts
const saved = serializeParsegraphDocument(root, { appearance });
const loaded = deserializeParsegraphDocument(saved);
const colors = resolveNodeAppearance(loaded.appearance, node.id());
```

`appearance` is optional shorthand for replacing `appearance/1` in the writer's
capability map. The reader exposes it as `loaded.appearance` only when present.
The helper returns a fresh resolved object and expects a validated payload.
Passing the loaded state back to the writer preserves appearance and unknown
capabilities. Deleting/renaming nodes requires updating appearance node IDs,
just as it does for presentation assignments.

The core library validates and preserves this capability; the SVG exporter also
renders it. Freeform still needs its own read/write/render integration.

## Freeform migration mapping

The existing builders return `[root, selectedNode, roomName, viewportData]`;
colored examples put their color overrides in `viewportData.styles`. The
viewport resolves those overrides against its default node style.

| Existing Freeform data | V1 destination |
| --- | --- |
| Effective `viewport.defaultNodeStyle()` | `appearance/1.defaults` (all eight color/alpha fields) |
| `viewport.styles[nodeId]` | `appearance/1.nodeStyles[nodeId]` (sparse overrides) |
| Effective page background | `pageBackgroundColor` plus `pageBackgroundAlpha` |
| Camera and selection | `metadata.freeform`, not appearance |

Builders often specify only `backgroundColor` and `backgroundAlpha`. Preserve
those overrides, but export a complete set of effective defaults so other
viewers do not guess the missing border/text/connector colors. Preserve the
association when converting old numeric IDs to v1 string IDs.

Legacy page background paths use `Color.asRGBA()` while some editor paths use
hex. Decode using the appropriate legacy reader, then export RGB as six-digit
hex and alpha separately. Do not copy an `rgba(...)` string directly into this
capability. Do not add color fields to `presentation/1`; its validator rejects
them. Existing v0 loading/export can keep its established `viewport` fields.

`buildAlternatingColumns` assigns one random opaque color per column.
`buildRandomRainbow` assigns interpolated row colors and a random page
background. `buildRainbow`/its vertical variant assign color samples and a dark
page background. These are good acceptance cases: preserve the colors through
v1 import/export, edits, undo/redo, and ID remapping. Export generated colors as
concrete values; displaying them never requires re-running a random generator.

The [appearance fixture](../examples/fixtures/appearance-colors.parsegraph)
covers defaults, overrides, independent alpha, transparent fill, and parent-owned
connector color. Render it using `yarn render:svg examples/fixtures/appearance-colors.parsegraph --output generated/appearance-colors.svg`.
