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

CMake consumers can use `add_subdirectory(path/to/parsegraph/native)` or the
installed package below. Both expose `parsegraph::parsegraph` (the complete core)
and `parsegraph::extent` (Extent only). The build creates `libparsegraph.a` and
its dependency `libparsegraph_extent.a`; manual link commands need both archives,
in that order, and `-lm` on Unix. CMake targets carry these dependencies and the
public include directory automatically. Internal warnings, floating-point flags,
and sanitizer policy are not imposed on consumers. The archives are built with
position-independent code so they can also be linked into application plugins.

## Install and consume

Build a clean, unsanitized package from the repository checkout. Only a C compiler
and CMake are required for this configuration; no JavaScript, C++, Qt, or graphics
dependencies are needed:

```sh
cmake -S native -B native/build-package -DCMAKE_BUILD_TYPE=Release \
  -DBUILD_TESTING=OFF -DPARSEGRAPH_SANITIZE=OFF -DPARSEGRAPH_TS_PARITY=OFF \
  -DPARSEGRAPH_BUILD_EXAMPLES=OFF -DPARSEGRAPH_BUILD_BENCHMARKS=OFF
cmake --build native/build-package --parallel 2
cmake --install native/build-package --prefix "$HOME/.local/parsegraph"
```

Installation is explicit; building does not write to system directories. Sanitized
builds reject installation to avoid distributing archives that require an
undocumented sanitizer runtime. Use a separate build directory as shown above.

A separate application's `CMakeLists.txt` needs:

```cmake
find_package(parsegraph 0.1 CONFIG REQUIRED)
target_link_libraries(my_application PRIVATE parsegraph::parsegraph)
```

Configure that application with `-DCMAKE_PREFIX_PATH="$HOME/.local/parsegraph"`.
Use `parsegraph::extent` instead for Extent-only clients. There is no separate
C++ library: the same headers and archives expose a C ABI usable from C++.
See [examples/installed](examples/installed) for runnable C and C++ consumers:

```sh
cmake -S native/examples/installed -B native/build-consumer \
  -DCMAKE_PREFIX_PATH="$HOME/.local/parsegraph"
cmake --build native/build-consumer --parallel 2
ctest --test-dir native/build-consumer --output-on-failure
```

You can move the installed prefix as a unit and configure new consumers against
its new location. GNUInstallDirs controls `CMAKE_INSTALL_LIBDIR`,
`CMAKE_INSTALL_INCLUDEDIR`, and `CMAKE_INSTALL_DATADIR`; they must be relative
paths contained within the prefix. With unusual library directory layouts, pass
`-Dparsegraph_DIR=<prefix>/<libdir>/cmake/parsegraph` directly.

### Native version and distribution policy

The native package is **0.1.0**, independently versioned from the TypeScript/npm
package. During the experimental 0.x period, breaking native API or struct-layout
changes require a new minor version; compatible fixes increment the patch.
`find_package(parsegraph 0.1 ...)` accepts compatible 0.1.x packages, not 0.2.x
or npm version 7. An exact version can be requested with `EXACT`. There is no
stable binary ABI promise: rebuild consumers when upgrading native packages.

Source builds from this repository and platform-specific static archives are the
initial distribution formats. Linux and macOS are the CI acceptance platforms;
Windows binary distribution is not yet validated. Shared `.so`/`.dylib`/DLL
packages, symbol-export policy, package-manager publication, and signed Qt app
bundles are separate milestones. This packaging work does not publish a release.

Create a relocatable archive of the headers, libraries, CMake configuration,
license, and README with:

```sh
SOURCE_DATE_EPOCH=$(git log -1 --format=%ct) ZERO_AR_DATE=1 \
  cmake --build native/build-package --target package
```

CPack writes `parsegraph-native-0.1.0-<system>-<architecture>-<compiler>-<version>.tar.gz`
in the build directory. Extract it and use the extracted top-level directory as
`CMAKE_PREFIX_PATH`. Archives are tied to their platform, compiler/toolchain and
build configuration; they are not universal binaries. CI produces Release
archives and SHA-256 manifests on Linux and macOS. `SOURCE_DATE_EPOCH` normalizes
archive timestamps; `ZERO_AR_DATE` prevents Apple's archive index timestamps from
changing during installation. Tests verify repeated packaging of the same build
produces an identical checksum with these settings. Checksums identify an
artifact; byte-identical clean builds across different paths, users, SDKs, or
toolchains are not promised.

The `installed_package` and `installed_package_custom_dirs` CTests build a minimal
source snapshot without JavaScript or test sources, install and relocate it,
and also unpack its CPack archive. They remove the producer source and build
directories before building external C/C++ consumers, check exported requirements,
exercise layout and Extent, and reject incompatible version requests, absolute
install directories, and sanitized installation. These tests
run in the native CI matrix, including alongside sanitized behavior tests.

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

An optional [Qt Quick viewer](qt-viewer/README.md) opens v1 documents through
the native library, with a bundled proportion demo, pan/zoom, node selection,
and paint-group/extent-bound overlays. Enable `PARSEGRAPH_BUILD_QT_VIEWER` to
build it with Qt 6.7 or newer; Qt is not required by the core library.

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
