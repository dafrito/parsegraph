# Native layout benchmarks

`benchmark.c` exercises construction, navigation, Extent unions, full and incremental layout, flattening, and movement across paint-group boundaries. It emits CSV to stdout and a small checksum/structure-size diagnostic to stderr. It has no renderer, GPU, file parsing, or TypeScript runtime in the measured code.

Run an optimized build. Sanitizers are useful for correctness checks but change timing substantially. From the repository root:

```sh
cc -std=c11 -O3 -Wall -Wextra -Wpedantic -Werror -ffp-contract=off \
  -I native/include \
  native/src/types.c native/src/extent.c native/src/node.c \
  native/src/caret.c native/src/layout.c native/bench/benchmark.c \
  -lm -o /tmp/parsegraph-benchmark
/tmp/parsegraph-benchmark --nodes 2000 > /tmp/parsegraph-2000.csv
```

`--nodes` defaults to 2,000 and must be at least 2. Run several sizes, for example 500, 1,000, 2,000, and 4,000. The exact staircase-comb case deliberately grows expensive; large counts can require quadratic time and memory. The nested-group workload adds four nodes to the requested count. Its large group contains `nodes + 1` nodes.

The benchmark exits unsuccessfully on a library error, an unexpected traversal count, a group movement that did not change world coordinates, or lost local caches after group movement or scaling with unchanged local geometry. Time measurements are observations, not test thresholds. It uses C11 `timespec_get(TIME_UTC)` and detects a backwards clock movement. Repeated trials and a quiet machine are needed for comparisons, especially for sub-millisecond rows.

## Workloads

| Row | Work measured |
| --- | --- |
| `construct` | Storage allocation, node allocation, connection, and creation of a layout object for a forward chain. |
| `node_walk` | 64 traversals along the forward chain through the node API. |
| `caret_walk` | The corresponding 64 traversals through Caret, including resetting to the origin. |
| `caret_spawn` | Allocating and connecting all but the initial chain node through Caret; initial storage/root/Caret allocation is outside the timer. |
| `caret_restore` | 64 rounds of named-mark lookups. Nodes, keys, and marks are prepared outside the timer. |
| `extent_combine` | 64 unions of two sawtooth extents, with a half-unit offset. Exact and simplified outputs intentionally differ. Input creation is outside the timer; result allocations and reuse are included. |
| `full_layout` | First complete layout of the generated graph. |
| `noop_layout` | 1,000 calls on an already committed graph; requires zero layout work units. |
| `leaf_resize` | Three body-height changes at the final leaf, including invalidation and relayout. |
| `flatten_cold` | One absolute-transform query for every node, before transform caches are warmed. |
| `flatten_warm` | The same queries immediately afterward. |
| `group_sibling_resize` | 64 resizes of a sibling that move a large nested group. |
| `group_root_resize` | 64 root-body resizes that move the nested group. |
| `group_outer_scale` | 64 changes to the outer group's scale. |
| `group_large_scale` | 64 changes to the large group's own scale. |

All graph shapes use deterministic dimensions and a four-unit gap:

- **Deep:** a forward chain of equal-sized bodies. A leaf change necessarily revisits every ancestor.
- **Balanced:** a breadth-first binary tree with forward and downward children. A leaf change revisits a logarithmic-depth path, skipping clean sibling subtrees.
- **Comb:** a forward spine with upward teeth of successively decreasing height. Its exact envelope is a staircase, and ancestor extents retain substantial detail. Loose fitting collapses each combined envelope into a bounding box, which can materially change the final graph's spacing.
- **Nested groups:** a root and sibling, an outer creased group, and a large inner creased group containing a balanced subtree. External changes can move the inner group without relaying out its nodes or rebuilding its local transforms.

The complete graph is built before layout timers start. Graph destruction, whole-graph memory accounting, cache validation, and CSV output are outside all layout timers. The group rows measure mutation and layout; the final absolute-transform query and comparison with the original transform occur afterward. They therefore isolate layout work from the cost of flattening/drawing all nodes.

## Reading the CSV

`nodes_committed`, `nodes_measured`, `work_units`, and `clean_subtrees_skipped` are totals across `iterations`, from the layout's public metrics. An iteration of `node_walk`, `caret_walk`, or `caret_restore` processes `nodes` operations; an iteration of a layout row is a single layout call/update. The `checksum` keeps queried results observable and is not an equivalence test between fits.

Memory columns describe the state after the measured operation:

- `extent_bounds`: live bound records across the four cardinal extents of every node; for `extent_combine`, just its output extent.
- `extent_capacity_bytes`: total allocated Extent buffer capacity multiplied by `sizeof(pg_bound)`, including unused capacity.
- `node_bytes`: `node_count * sizeof(pg_node)` for this build. This includes inline edge/extent descriptors and caches, but excludes their separately allocated buffers.
- `local_cache_retained`: only meaningful for group rows. The number of large-group nodes whose previously warmed local position/scale and generation remained valid immediately after the update, before querying transforms again.

These are **allocation-accounting observations, not peak RSS**. They exclude allocator metadata, painter values, traversal stacks, Caret storage, benchmark arrays, temporary Extent union buffers, and executable/runtime memory. The benchmark includes `node_internal.h` for this diagnostic accounting; consumers should use the public opaque node API.

## Initial observations

An illustrative run on this workspace's ARM64 Mac, using Apple Clang 21.0.0 and `-O3 -ffp-contract=off`, produced:

| Nodes | Exact comb full layout | Loose comb full layout | Exact live bounds | Loose live bounds |
| ---: | ---: | ---: | ---: | ---: |
| 500 | 3.15 ms | 0.12 ms | 96,375 | 2,000 |
| 1,000 | 11.36 ms | 0.24 ms | 380,250 | 4,000 |
| 2,000 | 52.76 ms | 0.48 ms | 1,510,500 | 8,000 |
| 4,000 | 170.26 ms | 0.95 ms | 6,021,000 | 16,000 |

These single-run times are illustrative, not a promised speedup. The reproducible bound counts expose the underlying scaling: this exact staircase case stores quadratic aggregate detail, whereas loose fitting stores four bounds per node. At 2,000 nodes, allocated Extent buffers were about 16.3 MB for exact and 64 KB for loose. The node struct was 792 bytes on this build, and a bound was 8 bytes. Different ABIs or future node representations can change those sizes.

The 2,004-node group scenario retained all 2,001 large-group local caches after sibling resizing, root resizing, outer-group scaling, **and scaling the large group itself**. Each update committed only two, one, two, and three nodes respectively. That verifies the intended group separation independently of timing. In a rerun after the scale optimization, the 64 updates in each scenario took approximately 0.027, 0.023, 0.036, and 0.058 ms respectively; the cache retention checks, rather than those short timings, are the durable evidence.

The first benchmark run exposed unnecessary cache invalidation when changing the large group's own scale. This is now fixed: scale changes invalidate the affected outer coordinate space, while a layout commit advances a group's local generation only when its local geometry changes. The group root is still remeasured, so a host's scale-dependent measurement callback can intentionally change the geometry and invalidate those caches. Separate layout tests cover that case. This benchmark's fixed dimensions require all local caches to survive each of the four group scenarios.

There is no TypeScript timing comparison in this benchmark. Native-versus-TypeScript speed claims require a separate harness with identical graph generation, callback work, cold/warm state, and build configuration.
