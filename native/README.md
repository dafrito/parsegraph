# Native Parsegraph

A C11 implementation of Parsegraph's graph API and two-dimensional layout
algorithm. Applications own content, text measurement, graphics, input, and
platform integration. The library produces extents, connector geometry, and
positions in paint-group and absolute coordinates. It has no renderer, GPU,
JSON library, or JavaScript dependency at runtime.

The C API is also usable from C++. This is an initial native implementation,
with an experimental API and no stable ABI promise yet. TypeScript remains a
supported implementation; differential tests run against its current sources.

## Build

From the repository root:

```sh
cmake -S native -B native/build -DCMAKE_BUILD_TYPE=Debug -DPARSEGRAPH_SANITIZE=ON
cmake --build native/build -j
ctest --test-dir native/build --output-on-failure
```

The differential tests need the repository's installed Node/TypeScript development
dependencies. To build and test without JavaScript, set
`-DPARSEGRAPH_TS_PARITY=OFF`. Set `-DBUILD_TESTING=OFF` to omit the C++ compiler
requirement and all tests. Examples and benchmarks have separate
`PARSEGRAPH_BUILD_EXAMPLES` and `PARSEGRAPH_BUILD_BENCHMARKS` switches.

CMake consumers can use `add_subdirectory(path/to/parsegraph/native)` and link
`parsegraph::parsegraph`. The build creates `libparsegraph.a` and its dependency
`libparsegraph_extent.a`; manual link commands need both archives, in that order,
and `-lm` on Unix. A shared-library release and package-manager distribution are
separate follow-up work. No system installation or publication is performed.

## Public API

| Header | Responsibility |
| --- | --- |
| `parsegraph/types.h` | Enum values, aliases, direction/axis helpers. Values match TypeScript. |
| `parsegraph/extent.h` | Circular extent storage, separation, union, loose simplification. |
| `parsegraph/node.h` | Nodes, connections, edge metadata, preferred axes, groups, transforms, hit testing. |
| `parsegraph/caret.h` | Non-owning graph walker, construction helpers, stack and named marks. |
| `parsegraph/layout.h` | Measurement/spacing callbacks, incremental layout, resumable work and metrics. |
| `parsegraph/paint.h` | Headless body/connector rectangle emission and paint-group drawing bounds. |

Functions returning `pg_status` report `PG_OK`, `PG_INVALID`, `PG_RANGE`, or
`PG_NOMEM`. Constructors return NULL on allocation failure. Getter sentinels and
special cases are documented in the headers. Check return values; the API does
not abort or throw. Invalid directions, cycles, nonfinite geometry, and invalid
scales are rejected rather than allowed to corrupt the graph. Scales must be
positive and dimensions nonnegative. Extent lengths and sizes use float32 storage
with double arithmetic, as in TypeScript. Do not enable fast-math.

### Ownership

- `pg_node_new(value)` allocates one node. The `void *` value remains caller-owned;
  changing or freeing a node never frees its value.
- `pg_node_free(node)` destroys **only that node**, detaches its parent and children,
  and leaves surviving subtrees usable. It does not reject a node for having children.
- `pg_node_free_tree(node)` explicitly destroys that node and its descendants.
  It first detaches the subtree from its parent and uses an iterative walk, so
  deep trees do not consume the C call stack.
- Connecting into an occupied direction detaches the old child. Reparenting also
  detaches the incoming node from its old parent and any child occupying its new
  parent-facing direction. None of these displaced nodes is freed. Keep handles
  to displaced nodes if they will later need destruction.
- Carets, named marks, layout sessions, and graph connections borrow nodes.
  Free/reset those borrowers or remove their references before destroying nodes.
  `pg_caret_free` does not destroy the graph. Caller-held stale pointers cannot
  be detected by the library.
- `PG_DIRECTION_NONE` means the current node or its parent edge where documented;
  numeric `PG_INWARD` is zero and is always a real direction.

The implementation is single-threaded and has no internal locking. Mutations use
process-local epochs and generated IDs; external synchronization must cover all
library calls across graphs if used from multiple threads. Mutation of a separate
graph may conservatively restart a suspended layout or invalidate absolute caches.

### Layout and dynamic graphs

Supply a `pg_layout_painter` with a measurement callback and optional spacing
callback. Children are committed before their parent is measured, allowing a
container to size itself from its inward child's extents. Alternatively, call
`pg_node_set_size` for every node and pass a NULL painter. Values have no assumed
presentation; the native core does not interpret `.parsegraph` JSON, fonts,
colors, or v1 capabilities. Those are application/adaptor responsibilities.

```c
pg_node *root = pg_node_new(NULL);
pg_node *child = pg_node_new(NULL);
/* Check constructors and each returned status in production code. */
pg_node_set_size(root, 40, 20);
pg_node_set_size(child, 20, 20);
pg_node_connect(root, PG_FORWARD, child);
pg_node_crease(child);
pg_layout *layout = pg_layout_new(root, NULL);
pg_layout_run(layout);
pg_transform world;
pg_node_absolute_transform(child, &world);
/* world = {30, 0, 1}; draw using this transform and child dimensions. */
pg_layout_free(layout);
pg_node_free_tree(root);
```

Node/edge setters invalidate the affected ancestor path. A committed subtree is
skipped in constant time during subsequent layout. If an application's value or
measurement policy changes in place, call `pg_node_invalidate` on affected nodes;
changing a pointer to itself cannot announce a content change automatically.

`pg_layout_step(layout, budget, &done)` performs bounded traversal work. One work
unit scans a child edge or commits a node. An extent merge or consecutive-path
alignment within that node is not preemptible, so the budget is **not a hard
wall-clock deadline**. Topology/property changes between calls restart traversal
safely and reuse committed subtrees. Do not mutate or free nodes inside callbacks.
Free/reset the layout before destroying the node returned by `pg_layout_root()`;
this may differ from the constructor argument and can change after reparenting.
Errors keep unfinished nodes dirty for retry; previously committed work is retained. Query final geometry
only after a successful completed layout; caches may contain previous geometry
while a graph is dirty.

### Paint groups and drawing

A root is always a paint group; `pg_node_crease` starts another group and
`pg_node_uncrease` joins it back into its parent's group. Sibling links form an
intrusive circular postorder list of the nodes inside a group. Public preorder
and paint-group traversal helpers are available for walking a complete graph.

A node's group transform excludes the group's own placement/scale. The group's
absolute transform places that local coordinate system in the world:

```text
world_x = group_world_x + node_group_x * group_world_scale
world_y = group_world_y + node_group_y * group_world_scale
world_scale = node_group_scale * group_world_scale
```

`pg_paint_node_bounds` and `pg_paint_node_lines` emit rectangles in group space.
Cache those rectangles per group, and apply the group's world transform when
rendering. An external group movement leaves its internal local-transform caches
valid. Flattening every node to absolute coordinates is optional and necessarily
costs a traversal; the library does not require it on each group movement.

`pg_paint_group_bounds` unions the actual body/connector drawing rectangles,
including inward contents and excluding bodies in other groups. This is separate
from the layout extents, which include descendant geometry needed for separation.

A complete standalone renderer is in [examples/svg.c](examples/svg.c):

```sh
native/build/parsegraph_svg > generated/native-demo.svg
```

It constructs a graph through Caret, lays it out, and writes SVG using only the
public API and libc. This demonstrates the boundary between library and renderer;
it is not a `.parsegraph` file importer.

## Validation and performance

CTest covers enums, ownership and randomized topology, Caret stacks/marks,
measurement failure recovery, allocation failures, exact/loose geometric oracles,
deep graphs, dynamic edits, paint groups, C++ consumption, Extent parity, and
whole-graph TypeScript parity. The differential harness compares body dimensions,
all extent segments/offsets, edge alignment/separation/positions, sibling rings,
group and absolute transforms, and drawing rectangles. The committed SVG geometry
fixtures use identical synthetic text measurement in both implementations.

See [EXTENT.md](EXTENT.md) for the original Extent design and its resolved bugs.
The native port also found and repaired TypeScript defects in Caret direction
handling, parent metadata, sibling ordering, fresh naive layout, and scaled
opposing-subtree separation. Regressions remain in the TypeScript suite.

See [bench/README.md](bench/README.md) for reproducible benchmarks and observed
scaling. Exact fitting can accumulate quadratic total extent detail on staircase
shapes; loose fitting deliberately retains only a box. The API is not a promise
of linear layout for every topology. Benchmarks separate full layout, dirty-path
updates, group movement, and full-graph flattening. There is currently no matched
TypeScript timing baseline, so no native speedup factor is claimed.
