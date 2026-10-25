# Directional focus (`focus/1`)

Focus is optional framing intent on a node. It does not affect layout, extents,
fit, alignment, topology, paint groups, or ownership. A viewer can use the
resolved bounds to choose a camera target, padding, scale limits, and animation.
This capability does not itself move a camera.

## Selection and bounds

A selection is a set of child directions. Resolve it by taking the tight,
axis-aligned union of the current node's body and every body in each selected
child's complete descendant subtree. Descendant focus preferences do not prune
that subtree. Unselected branches of the current node are excluded.

For example, selecting `downward` and `upward` on a horizontal multislot bud
includes both contents but excludes its `forward` sibling continuation. All
branches within either selected child's subtree are included, even if those
branches themselves point forward. INWARD content and nested paint groups are
included with their accumulated scales and positions.

Bounds use graph coordinates and fields `left`, `top`, `right`, `bottom`.
They cover bodies, not connector stroke thickness, shadows, labels drawn outside
measured bodies, or camera padding. They are not the node's accumulated Extent
bounding box: loose-fit whitespace must not enlarge framing bounds.

- Missing selection: unset; use the consumer's fallback selection.
- Empty selection: explicitly frame only the current body.
- Missing child connection: contributes nothing.
- `outward`, invalid directions, and the node's current parent-facing direction:
  rejected. No traversal toward ancestors is supported.
- Repeated TypeScript setter directions are deduplicated. A setter replaces the
  previous set atomically. Document arrays must not contain duplicates.
- Focus stays on the node when a caret moves or a node is reparented. If
  reparenting makes a selected direction parent-facing, the query and v1 export
  reject it until the selection is changed or cleared. Topology is never changed
  merely to preserve focus.

Queries require completed layout, including after mutations. They do not run the
layout algorithm. Traversal is iterative and visits only the current body and
selected subtrees, without expanding an ancestor's extent buffers or caching a
second hierarchy of bounds. C also resolves transforms lazily. Work is
proportional to visited bodies plus ancestor/transform resolution; this is not a
constant-time query. Consumers may cache results against their own layout and
focus changes.

## TypeScript

```ts
caret.focus(Direction.DOWNWARD, Direction.UPWARD); // replaces current node's intent
caret.focus();                                  // explicit body only
caret.clearFocus();                             // unset

node.setFocus(Direction.DOWNWARD);
node.focusDirections(); // defensive copy of Direction[], or undefined
node.clearFocus();

// After CommitLayout finishes:
const explicit = node.layout().boundsForDirections(
  Direction.DOWNWARD, Direction.UPWARD
);
const focused = node.layout().focusBounds(Direction.DOWNWARD);
// Uses the stored selection when present, otherwise the supplied fallback.
// With neither a stored selection nor a fallback, returns body-only bounds.
```

The Caret accepts direction enums and the existing string aliases. Node and
Layout methods take direction enums. Invalid selections or nonfinite/uncommitted
geometry throw. Setting/clearing focus does not invalidate layout; consumers
must handle their own camera/UI notification.

## C

Include `parsegraph/node.h` and, for Caret helpers, `parsegraph/caret.h`.
Direction masks are distinct from `pg_direction` enum values.

```c
pg_status status = pg_caret_set_focus(caret,
    PG_FOCUS_DOWNWARD | PG_FOCUS_UPWARD);
if (status != PG_OK) { /* handle invalid selection */ }

pg_bounds bounds;
status = pg_node_focus_bounds(node, 0, &bounds);
// bounds.left, bounds.top, bounds.right, bounds.bottom

status = pg_node_bounds_for_directions(node, PG_FOCUS_DOWNWARD, &bounds);
pg_focus_mask mask;
bool is_set = pg_node_get_focus(node, &mask);
pg_node_clear_focus(node);
pg_caret_clear_focus(caret);
```

`pg_bounds` uses edges, unlike the existing painting `pg_rect`, which uses center
coordinates and dimensions. `pg_node_set_focus` is the node setter. Available
bits are `PG_FOCUS_INWARD`, `PG_FOCUS_DOWNWARD`, `PG_FOCUS_UPWARD`,
`PG_FOCUS_FORWARD`, and `PG_FOCUS_BACKWARD`. Zero is an explicit empty selection.

Invalid input or incomplete layout returns `PG_INVALID`; arithmetic overflow
returns `PG_RANGE`, and lazy transform allocation can return `PG_NOMEM`.
Bounds outputs and stored selections remain unchanged on failure.
`pg_node_get_focus` returns false without touching its output when unset or given
NULL inputs; clear operations accept NULL. A fallback is evaluated only when
focus is unset. Native nodes still borrow their values and retain normal lifetime
rules. The C core has no JSON document parser; adapters translate capability
strings into these masks.

## Document payload

Under a v1 document's `capabilities`:

```json
{
  "focus/1": {
    "nodeDirections": {
      "operand-bud": ["downward", "upward"],
      "literal": []
    }
  }
}
```

`nodeDirections` is required. It maps existing node IDs to arrays of distinct
lowercase names: `inward`, `downward`, `upward`, `forward`, `backward`. Arrays
represent unordered sets. Missing IDs are unset; `[]` is body-only. An empty map
is valid. Unknown fields, unknown IDs, invalid names, duplicates, and
parent-facing selections are rejected by supporting readers before graph
construction. Connections need not exist in the selected directions.

`deserializeParsegraphDocument` restores preferences after topology is built,
independent of node-record ordering. `serializeParsegraphDocument` derives
`focus/1` from current node preferences, so clearing preferences or deleting
nodes cannot resurrect stale capability entries from loaded options. Callers
should set focus on nodes rather than injecting this known capability through
`options.capabilities`. A supplied `focus/1` key retains the capability envelope,
even if its current map is empty; otherwise it is emitted only when a node has
an explicit preference. Other capabilities remain preserved as before.

Readers without support may preserve the opaque capability and use their normal
camera framing. Existing viewers do not automatically gain focus-aware camera
behavior merely by loading the library. V0 serialization remains unchanged and
does not retain focus; use v1 for this feature. No v1 envelope or node-record
schema change is needed.
