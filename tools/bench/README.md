# Matched TypeScript / C benchmarks

This is a headless comparison harness, with **JSONL events for agents** and a
**standalone HTML report with Matplotlib charts for people**. It complements the
existing [native CSV benchmarks](../../native/bench/README.md) and Qt viewer
measurements. It does not run a renderer or measure fonts, GPU work, or VRAM.

## Run

Requires the repository's installed Yarn dependencies, CMake, a C compiler,
Node, and Python 3.10+ on macOS or Linux. Put the report dependency in a virtual
environment; it is not part of the npm or C library package:

```sh
python3 -m venv /tmp/parsegraph-bench-env
/tmp/parsegraph-bench-env/bin/python -m pip install -r tools/bench/requirements.txt
/tmp/parsegraph-bench-env/bin/python tools/bench/bench.py run \
  --output generated/benchmarks/my-first-run
```

With the environment activated, `yarn bench --output ...` is equivalent.
The harness compiles TypeScript ahead of time into `dist-tools/bench`, and builds
the C worker in `native/build-bench` using Release, no sanitizers, and two build
workers. All timed workers run **sequentially**. The output directory must not
already exist, so earlier evidence is never overwritten.

Defaults: seven shapes, node budgets 64/256/1024, both exact and loose fitting,
five fresh-process trials per runtime/case, and two in-process warmups before
each measured trial. A quick end-to-end check:

```sh
/tmp/parsegraph-bench-env/bin/python tools/bench/bench.py run \
  --output generated/benchmarks/smoke --nodes 32 --repeats 1 --warmups 0
```

Select `--shapes deep balanced comb groups proportion memory-piers rainbow`,
`--fits exact loose`, `--seed 20261024`, `--repeats`, and `--warmups` as needed.
`--nodes` always means a **node budget**, not a primes number or gallery parameter.
Inputs are capped at 4,096 actual nodes. Demo parameters are conservatively
bounded before generation, then reduced until they fit the budget. Exact combs
can still consume quadratic storage. Each worker has a timeout (default 30s),
and Node has a 256 MiB old-space limit; that is not a total RSS cap. Do not use
these caps as evidence that every maximum-sized graph is cheap.

## Outputs and reuse

- `events.jsonl`: versioned, flushed event stream and raw timing samples.
- `report.html`: portable HTML with embedded charts and a filterable table.
- `report.summary.json`: per-operation medians, quartiles, extrema and memory
  observations derived from accepted samples.
- `report-charts/*.svg` and `*.png`: standalone plots for documents and sharing.
- `report-graphs/*.svg`: one small measured graph per shape, in exact and loose
  fit. The report embeds these previews and links to the standalone SVGs.
- `illustrations/`: drawing primitives and a manifest tied to the event stream.
- `fixtures/*/fixture.txt` and `fixture.json`: exact shared inputs and hashes.
- `logs/`: build configuration, verification geometry, raw worker JSONL, stderr.

Regenerate the report or render it elsewhere without rerunning measurements:

```sh
/tmp/parsegraph-bench-env/bin/python tools/bench/bench.py report \
  generated/benchmarks/my-first-run/events.jsonl \
  --output generated/benchmarks/my-first-run/review.html
```

The HTML charts work without network access or adjacent files. Links to raw
events, summary JSON, and SVG exports need those companion files. Keep the whole
directory for reproducible investigation. Reports preserve failed/interrupted
status, and exclude unverified or incomplete cases from charts/statistics.
After a build failure or interruption, the partial JSONL can also be rendered
using this command. Timing assertions are deliberately absent from tests.

New runs automatically generate graph illustrations. To add them to an existing
run, retain its `fixtures/` and verification `logs/`, then run:

```sh
/tmp/parsegraph-bench-env/bin/python tools/bench/bench.py illustrate \
  generated/benchmarks/my-first-run/events.jsonl
/tmp/parsegraph-bench-env/bin/python tools/bench/bench.py report \
  generated/benchmarks/my-first-run/events.jsonl \
  --output generated/benchmarks/my-first-run/report.html
```

Illustration compiles the TypeScript worker and lays out only the smallest
accepted size for each shape/fit. No timings are rerun or changed. It verifies
the resulting node geometry against the saved native full-layout snapshot, then
uses the public body/connector painting helpers to produce SVG. If library
changes alter that geometry, illustration fails rather than showing a different
graph as historical evidence. Thumbnails fit independently for legibility, show
their actual bounds, and offer a same-scale toggle to compare packing. Colors
identify paint groups; sizes are the actual
synthetic benchmark sizes. Report regeneration subsequently needs only the saved
illustrations and events, and does not invoke Node or the layout algorithm.

## Workload contract

Both implementations reconstruct the **same parent-first records** in the same
order. The numeric text file starts with a node count, then one row per node:

```text
parent_index direction width height scale explicit_crease preferred_axis alignment overlap
```

The root uses parent and direction `-1`. Direction/enum values match the public
TypeScript/C API. Alignment and overlap belong to the parent-to-child edge.
This is a private benchmark input protocol, **not a new `.parsegraph` format**.
Both workers allocate nodes, connect topology, restore preferences, and create
their layout session within the construction timer. Input parsing is excluded.

- **Deep, balanced, comb:** the same topology rules as the native baseline. The
  comb's decreasing-height upward teeth stress exact envelope detail.
- **Groups:** a root, sibling, outer group and nested balanced subtree, exercising
  movement across group boundaries.
- **Proportion, Memory Piers, rainbow:** actual existing generator topology,
  preferences and creases; Memory Piers uses the recorded deterministic seed.

All cases use a four-unit gap and precomputed synthetic body sizes. Synthetic
shapes use 24×16 bodies except comb teeth. Demo undefined values become 8×8 buds;
other values become `(24 + 8 × string length) × 16` bodies. This is intentionally
independent of font engines and gallery presentation rules: these are topology
stress workloads, not visual replicas or text-layout benchmarks. Fit is overridden
uniformly for each exact/loose case; different fits need not produce equal layouts.

## Timing and correctness

The TypeScript worker is compiled with `tsc` before execution. Module loading and
runtime startup are outside timers. Every measured process warms up on fresh
graphs, then constructs another graph for measurement. Node requests GC between
warmups and before the measured trial, never inside a timer. Native warmups free
their graphs. Allocation, automatic GC, and JIT effects during measured work
remain included. Two warmups do not establish an asymptotic JIT steady state;
vary warmups explicitly when studying that effect.

Runtime order is shuffled with the recorded seed for each pair. Shapes and sizes
run in a fixed order, so thermal drift and other machine activity can still affect
comparisons. Do not merge runs from different environments into one speed claim.

Each case measures construction, first full layout, 20 no-op calls, three leaf
height increments, three large root height increments, and (when present) four
alternating scales of the first explicit child paint group. Mutations are
sequential and cumulative. The final parent-first node is the resized leaf.

Each layout phase emits three observations:

- `/api`: mutation/invalidation plus the public layout call. **Not equivalent
  internal work:** TypeScript eagerly commits positions; C can defer transforms.
- `/placement`: query every node's group and absolute transform and accumulate
  a checksum, after the API call. C often performs more lazy work here.
- `/ready`: sum of those two timings, with the **same completed output contract**.
  This is the primary comparable end-to-end number, not a pure kernel benchmark.

Clocks are monotonic. JSONL `elapsed_ms` is the total for `iterations`; reports
divide first, then summarize per-operation observations with median and P25/P75.
The interquartile band describes observed dispersion, not confidence bounds.
No-op **ready** necessarily walks every node even if the raw native API does no
work. Inspect raw API measurements to investigate cache behavior.

Before timing a case, separate verification processes compare every node's local
and absolute transform, dimensions, extent offsets and bound counts after every
phase. Float tolerance is `1e-5 × max(1, |a|, |b|)`; bound counts match exactly.
These checks supplement, rather than replace, the full native parity suite that
also compares every extent segment. Timed trials must reproduce their verification
checksums and extent counts. Verification geometry and serialization stay outside
timed runs, so they cannot inflate measured worker memory. Failed cases stay in
the event log and are excluded from report statistics.

## Memory interpretation

Memory accounting occurs outside timers, immediately after each phase:

| Field | Meaning |
| --- | --- |
| `extent_bounds` | Live bound records in all four extents of all nodes. |
| `extent_capacity_bytes` | Allocated Extent capacity × 8 bytes in either runtime. |
| `node_struct_bytes` | C node storage from `sizeof(pg_node)`; unavailable for JS objects. |
| `fixture_body_and_index_bytes` | C benchmark-owned body and node-pointer arrays. |
| `peak_rss_bytes` | Process high-water RSS through this point, including startup and warmups. |
| `rss_bytes` | Node's current process RSS; unavailable in the native worker. |
| `heap_used_bytes` | Node/V8 heap usage, not a count of graph objects. |
| `external_bytes` | Node-managed external allocations. |
| `array_buffer_bytes` | Node ArrayBuffer allocations; a **subset** of external bytes. |

Unknown values are JSON `null`, not zero. Do not add all these fields together:
some overlap. Peak RSS captures allocator, traversal and temporary-buffer effects
but is not graph-exclusive; it cannot distinguish their owners. GUI snapshots,
labels, renderer buffers, GPU memory and process-isolated allocation tracing are
still separate benchmark work.

## JSONL contract (`parsegraph.bench/1`)

Every line is a JSON object with `schema`, `run_id`, monotonic `sequence`, UTC
`timestamp`, and `type`. Records are flushed as work progresses:

| Event | Payload |
| --- | --- |
| `run_start` | Commit, source-tree hash, dirty state, host/runtime versions, load, options and methodology. |
| `build` | Build commands, compiler configuration, flags, binary/worker hashes. |
| `fixture` | Shape, budget, actual nodes/groups, seed, generator parameter and exact input SHA-256. |
| `case_start` | Stable case key and fixture identity for a fit. |
| `parity` | Accepted geometry stages and comparison contract. |
| `sample` | Case/runtime/repeat/stage, elapsed milliseconds, iterations, work counters, checksum, memory and raw-log path. |
| `case_end` | `passed` or `failed`, plus failure detail. |
| `run_end` | Overall status, failed-case count and duration. Absence means interruption. |

`nodes_measured` is the number of body-measurement callbacks in the phase.
Native `work_units` comes from its public metrics; TypeScript has no equivalent
counter, so it is `null`. Phase counters/memory are repeated on api/placement/ready
rows; do not sum them across these three views. Agent example:

```sh
jq 'select(.type == "sample" and .stage == "full_layout/ready") |
    {case,runtime,repeat,ms_per_operation:(.elapsed_ms/.iterations),memory}' \
  generated/benchmarks/my-first-run/events.jsonl
```

## Validation

```sh
node_modules/.bin/tsc -p tools/bench/tsconfig.json --noEmit
/tmp/parsegraph-bench-env/bin/python -m unittest discover -s tools/bench -p 'test_*.py'
```

Tests cover geometry mismatches, exact bound counts, trial normalization,
unverified/failed/incomplete cases, missing/duplicate trials, stream integrity,
nonfinite JSON, and HTML escaping/embedded chart export. The bounded smoke run
above exercises both real workers, fixtures and report generation together.
