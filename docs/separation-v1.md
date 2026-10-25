# Separation fit and multislot spacing (`separation/1`)

Separation fit controls how two facing extents are compared while placing a
child. It is independent of node fit, layout preference, and directional focus.
The default is EXACT, preserving existing layouts.

```ts
caret.fitExact();
caret.pull(Direction.DOWNWARD);
caret.loosen();
// Build a horizontal multislot: downward content, forward continuation.
// Call this recipe at each bud that needs rectangular cross-axis clearance.

caret.tighten(); // Exact separation on the CURRENT perpendicular axis.
```

`loosen()` resolves the current preferred layout axis and sets both perpendicular
planar directions to LOOSE. `tighten()` sets those directions to EXACT. These are
one-time actions, not persistent links to pull and not undo operations. Calling
pull later does not move previously stored settings. A fresh root defaults to
horizontal-first, so loosen without pull affects DOWNWARD and UPWARD. New nodes
do not inherit separation settings; they default to EXACT.

## Node API

```ts
node.setSeparationFit(Direction.FORWARD, Fit.LOOSE);
node.separationFit(Direction.FORWARD); // Fit.LOOSE
node.setSeparationFit(Direction.FORWARD, Fit.EXACT);
```

Only DOWNWARD, UPWARD, FORWARD, and BACKWARD are accepted; only EXACT and LOOSE
are valid fits. NAIVE is a node-fitting strategy, not a separation policy.
Invalid input throws without changing state. A changed setting invalidates layout
and ancestors; repeating the same setting does not. Settings can be applied to
absent or parent-facing directions. Parent-facing settings are dormant: they do
not configure the parent's connection, and become active if later reparenting
makes that direction child-facing.

## Algorithm and order

EXACT compares detailed contours. LOOSE compares their rectangular envelopes
(total perpendicular span and maximum size), respecting alignment offsets,
scales, and axis-overlap rules. Bounds are queried without simplifying the
original extents. When two opposing children are laid out together, their mutual
comparison is boxed if either outgoing direction requests LOOSE; their separate
comparisons against the parent use their respective policies. Existing padding
and minimum body separation apply afterwards.

Pull decides which axis is positioned and combined first. Separation fit never
changes that order or performs lookahead. With DOWNWARD-first layout, the bud's
accumulated extents include downward content when FORWARD is separated. With
FORWARD-first layout, that content has not yet been positioned relative to the
bud. Loose FORWARD separation therefore cannot reserve its footprint. It is
legal, and can affect other graphs, but is not a multislot spacing recipe.

The incoming forward subtree includes the rest of the row, not just its first
bud. Boxed comparisons can consequently reserve more space than a hypothetical
semantic slot-only layout. They are conservative envelope comparisons, not a new
multislot graph type. If perpendicular spans do not overlap, existing
axis-overlap rules still apply; LOOSE does not force a gap between disjoint spans.

Node fit still controls the combine stage. EXACT nodes keep detailed combined
extents even after loose separation; LOOSE nodes continue simplifying them. NAIVE
node fit can preserve existing positions instead of rerunning separation, so use
EXACT or LOOSE node fit for predictable responsive spacing.

Inward-contained roots preserve absolute HORIZONTAL/VERTICAL preferences, just
like graph roots. `pull(DOWNWARD)` therefore lays out vertical content first,
and `loosen()` selects FORWARD/BACKWARD separation there too. Older builds
normalized an inward root's vertical preference to PERPENDICULAR and incorrectly
used horizontal-first layout. Legacy relative preferences retain their root-like
interpretation (PARENT is vertical-first; PERPENDICULAR is horizontal-first),
including when detached.

## C API

```c
pg_caret_pull(caret, PG_DOWNWARD);
pg_caret_loosen(caret);
pg_caret_tighten(caret);
pg_node_set_separation_fit(node, PG_FORWARD, PG_FIT_LOOSE);
pg_fit fit = pg_node_separation_fit(node, PG_FORWARD);
```

Check returned `pg_status` values. Invalid setters return PG_INVALID without
mutation; invalid getters return PG_FIT_NULL. The native implementation stores a
bitmask and computes boxed separation without temporary extent allocations.
Both implementations cache extent bounding values and preserve detailed extents.

## Document capability

```json
{
  "separation/1": {
    "nodeDirections": {
      "bud-1": ["forward", "backward"]
    }
  }
}
```

Entries list the concrete planar directions using LOOSE separation. Missing
entries/directions and empty arrays mean EXACT. IDs must exist in the document;
directions must be unique. Parent-facing and absent directions are allowed.
No pull relationship is serialized: the normal node layoutPreference supplies
ordering. This capability changes geometry, not colors or camera framing.

The v1 serializer derives this capability from nodes, replacing stale caller
options. It omits it when unused, except that a previously supplied capability is
retained as an empty nodeDirections map after tightening. The v1 loader applies
these settings after building topology. Legacy v0 does not preserve separation
settings. Consumers that ignore this capability retain exact separation and may
produce different spacing. The SVG renderer supports it through the document
loader; the native library exposes the API, but application codecs must opt in.
