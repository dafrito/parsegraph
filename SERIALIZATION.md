# The `.parsegraph` serialization format (v0)

The existing unversioned format described here is now called **v0**. See the
[v1 draft and capability specification](docs/parsegraph-v1.md) for the new
document envelope, presentation rules, and Freeform migration contract.

This page documents the format implemented by `serializeParsegraph` and
`deserializeParsegraph` in this repository, whose package version is currently
6.2.0. The file format itself has **no version field**. This is a description of
current behavior, including its limitations, rather than a new format proposal.

A `.parsegraph` file is a JSON document describing nodes, their content, their
parent-child connections, and layout instructions. It does **not** contain a
finished layout. A viewer measures content, runs the layout algorithm, and
renders the result.

## How nodes store data

Each node has one application-defined **`value`**. The serializer places the
result of `node.value()` in that field without converting it to a label or
interpreting its contents.

For example, a node record can contain a simple label:

```json
{ "value": "Hello, world" }
```

Or it can contain structured application data:

```json
{
  "value": {
    "kind": "directory",
    "label": "src",
    "path": "project/src",
    "expanded": false
  }
}
```

These are partial node records; a complete record also needs the structural
fields described below. The library assigns no special meaning to `kind`,
`label`, or any other keys inside `value`. A consumer must know how to interpret
them. A `path` in a value does not cause the library to load a file.

**Freeform currently displays strings and numbers as node labels.** Its
`nodeHasValue` predicate does not treat objects, arrays, booleans, or `null` as
label content. Structured values can travel through serialization, but an object
with a `label` property will not automatically display that label in Freeform.
Use string or number values for examples intended to display there unchanged.

Use JSON-compatible values: strings, finite numbers, booleans, `null`, arrays,
and plain objects containing such values. Important distinctions:

- `serializeParsegraph` returns a JavaScript object, not JSON text, and does not
  deep-copy values. Call `JSON.stringify` to produce file contents.
- An `undefined` node value is omitted by `JSON.stringify`; reading that record
  creates a node with an undefined value.
- Functions and symbols do not survive normal JSON serialization. Class
  prototypes are not restored; dates normally become strings. Circular values
  and ordinary BigInt values cause `JSON.stringify` to throw.
- Non-finite numbers such as `NaN` and `Infinity` become `null` in JSON.

## Document envelope and node identity

The serializer emits an object with a `__parsegraph` property. That property is
a map from node IDs to node records:

```json
{
  "__parsegraph": {
    "root": {
      "value": "Example",
      "scale": 1,
      "fit": 16,
      "layoutPreference": 3,
      "parentId": null,
      "parentDir": null,
      "alignment": 1,
      "paintGroup": true
    },
    "child": {
      "value": "Hello, world",
      "scale": 1,
      "fit": 16,
      "layoutPreference": 2,
      "parentId": "root",
      "parentDir": 5,
      "alignment": 1,
      "paintGroup": false
    }
  }
}
```

This describes a root and a child connected **forward from the root**. The
child stores `parentDir: 5` (`BACKWARD`) because the field points **from the
child toward its parent**. The reader reverses that direction when connecting
the child to the parent.

IDs live in the map keys; there is no separate `id` field inside each record.
Use unique string IDs. Numeric IDs are accepted by the node API, but map keys
and IDs restored by the reader are strings. Duplicate IDs can overwrite records
during serialization. Default generated IDs are not deterministic across runs;
set IDs explicitly for reproducible examples.

The reader also accepts a bare node map without the `__parsegraph` envelope.
Prefer the envelope when writing new files, especially when including metadata.

## Node record fields

| Field | Stored type | Meaning |
| --- | --- | --- |
| `value` | JSON value; may be absent | Application-defined content. |
| `scale` | Number | Node scale factor used by layout. Use a finite positive value, normally `1`. |
| `fit` | Numeric `Fit` enum | Requested fitting mode. |
| `layoutPreference` | Numeric `PreferredAxis` enum | Requested axis preference. |
| `parentId` | String or number; `null` for root | ID of this node's parent. String IDs are recommended. |
| `parentDir` | Numeric `Direction` enum; `null` for root | Direction from this node to its parent, not the parent's direction to this node. |
| `alignment` | Numeric `Alignment` enum | Alignment stored on the parent's connection to this child. The serializer writes `NONE` for the root. |
| `paintGroup` | Boolean | Whether this node starts a paint group. The root is a group; non-root group boundaries are restored by creasing the node. |

Writers should supply all structural fields. The reader does not provide a
general defaulting or schema-validation layer. The record is a description of
a rooted directional parent-child structure, not an arbitrary edge-list format:
there are no separate children arrays, edge objects, or cross-reference edges.

## Numeric enum values

These values are written directly to JSON. The deserializer does not translate
names such as `"FORWARD"` or `"LOOSE"` into enum values.

| Enum | Values |
| --- | --- |
| `Direction` | `INWARD = 0`, `OUTWARD = 1`, `DOWNWARD = 2`, `UPWARD = 3`, `FORWARD = 4`, `BACKWARD = 5` |
| `Fit` | `NULL = 14`, `EXACT = 15`, `LOOSE = 16`, `NAIVE = 17` |
| `PreferredAxis` | `NULL = 0`, `PARENT = 1`, `PERPENDICULAR = 2`, `HORIZONTAL = 3`, `VERTICAL = 4` |
| `Alignment` | `NULL = 0`, `NONE = 1`, `NEGATIVE = 2`, `CENTER = 3`, `POSITIVE = 4`, `INWARD_HORIZONTAL = 5`, `INWARD_VERTICAL = 6` |

The enum `NULL` members are numeric sentinels, not JSON `null`, and are not
recommended defaults. A normal root uses a horizontal or vertical preference.
For a child, parent/perpendicular preferences are relative to its connection to
the parent. Inward/outward describe containment, not a third spatial dimension.
An inward child records `OUTWARD` as its `parentDir`.

## Writing and reading with the current API

```ts
import { readFileSync, writeFileSync } from "node:fs";
import {
  DirectionCaret,
  serializeParsegraph,
  deserializeParsegraph,
} from "parsegraph";

const caret = new DirectionCaret<string>("Example");
caret.node().setId("root");
caret.spawnMove("f", "Hello, world").setId("child");

writeFileSync(
  "example.parsegraph",
  JSON.stringify(serializeParsegraph(caret.root()), null, 2),
  "utf8"
);

const document = JSON.parse(readFileSync("example.parsegraph", "utf8"));
const restoredRoot = deserializeParsegraph(document);
```

Construction and serialization need no browser, font measurement, or
`CommitLayout` pass. The current Node/Caret implementation does maintain
layout-related bookkeeping internally, but these operations do not compute a
finished layout.

The reader first creates all nodes, then connects them and applies alignment,
axis preferences, and group boundaries. Parent records therefore do not need
to appear before child records. Pass the actual graph root to the serializer;
its implementation traverses paint groups and siblings rather than defining a
general subtree-export operation.

## Freeform's additional fields

Freeform exports the core envelope together with two additional top-level
properties:

| Property | Meaning |
| --- | --- |
| `selectedNode` | The selected node's ID. |
| `viewport` | Freeform presentation state. Its current export contains `styles` keyed by node ID, `defaultNodeStyle`, `pageBackgroundColor`, and `cam`. |

Freeform's importer passes those fields to its viewer separately from
`deserializeParsegraph`. The core reader extracts `__parsegraph` and ignores
the surrounding metadata; reserializing only the returned root does not retain
that metadata. A generator can omit both fields and let Freeform use its normal
presentation behavior.

## What is not stored

The core format does not contain measured text sizes, computed node positions,
extent bounds, connection lengths, group transforms, or layout caches. It also
does not store the caret's navigation stack or saved positions, application
event handlers, or a connection to a generating program.

Consequently, the file preserves graph content and layout instructions, not an
exact image. Font and sizing policies can produce different geometry in
different viewers. The format is not a computed-geometry snapshot for comparing
layout implementations.

## Current limitations and round-trip gaps

- Node `rightToLeft` settings and per-connection `AxisOverlap` settings are not
  serialized. They revert to defaults when loaded.
- A root's explicit crease flag is not restored. The root still forms a paint
  group, but whether its boundary was explicitly requested is lost. For a
  non-root node, `paintGroup: true` is restored as an explicit crease.
- Alignment set on an unconnected direction is not stored: alignment is
  serialized through an existing child record.
- Unknown node-record properties are not preserved by deserialization and
  reserialization. Application payload belongs in `value`; additional envelope
  metadata must be retained separately by the application.
- The format has no version discriminator or migration mechanism. Numeric enum
  changes would affect compatibility.
- Input validation is limited. Writers should produce one connected, acyclic
  graph with exactly one root, unique IDs, existing parent references, legal
  directions, and no conflicting children in the same parent direction. The
  reader does not reliably reject malformed documents: missing parents can
  throw, multiple roots select the last root encountered, and conflicting
  connections may replace earlier connections. Empty input returns `null`.
- The TypeScript signatures do not precisely describe the envelope: the
  serializer casts its wrapped result with `as any`. The runtime format
  described here is the interoperability reference, not those signatures.

For the initial generator/viewer pipeline, use string labels, explicit string
IDs, the complete structural fields, and the existing envelope. Validation,
versioning, and fixes for omitted settings belong to the new document API;
the legacy v0 writer keeps this page's format unchanged.

## Implementation references

- [Serializer and deserializer](src/serializeParsegraph.ts)
- [Existing serialization tests](src/serializeParsegraph.spec.ts)
- [Direction enum](src/Direction/constants.ts)
- [Fit enum](src/DirectionNode/Fit.ts)
- [Preferred-axis enum](src/DirectionNode/Siblings/PreferredAxis.ts)
- [Alignment enum](src/DirectionNode/Neighbors/Alignment.ts)

Freeform behavior was checked against the sibling `freeform` checkout:
`src/components/ExportModal.js`, `src/components/ImportModal.js`,
`src/components/Viewport/Viewport.js`,
`src/components/Viewport/createLayoutPainter.js`, and `src/settings.js`.
