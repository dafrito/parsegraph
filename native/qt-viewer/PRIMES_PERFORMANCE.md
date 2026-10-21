# Native primes performance

Measured 2026-10-21 on the development Mac (ARM64, macOS 26.6.2),
Apple Clang 21, CMake Release, Qt 6.12.0 / Metal. The viewer window was
1120 × 800, device pixel ratio 1, on a 75 Hz display. These are local
observations, not timing assertions or native-versus-TypeScript comparisons.

The generator matches `examples/generators/primes.ts`: one base cell per
integer and one cell for each prime up to that integer, including blank cells.
It uses loose fitting, square math cells, zero gap, and the original creases.
The count means **integers through N**, not N prime numbers or N nodes.

## Cold native viewer

Medians of three independent process runs per size, milliseconds:

| Through | Nodes | Paint groups | C construction | C layout | Snapshot | Qt scene CPU | Through first frame submission |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 1,565 | 99 | 0.35 | 0.46 | 3.64 | 4.57 | 75.3 |
| 300 | 10,687 | 299 | 2.41 | 3.29 | 8.78 | 9.85 | 104.5 |
| 1,000 | 93,041 | 999 | 20.98 | 34.18 | 49.26 | 32.72 | 265.9 |

The last column includes session setup, validation, installing the snapshot,
initial graphics setup, and frame scheduling. It is not the sum of the four
phase medians. Qt scene CPU covers vertex/glyph creation and disposal of the
old scene on updates; it does not measure GPU execution.

All camera runs sampled 120 frames after 10 warmup frames. Median intervals
were approximately 13.3 ms at every size, consistent with the 75 Hz display.
At 93,041 nodes, per-run p95 intervals were 14.3–18.5 ms. Camera motion caused
**zero geometry rebuilds**. These measurements use `frameSwapped` timestamps,
which indicate queued presentation; they do not establish peak GPU throughput.

## Appending to the visible graph

Three runs started at 990 and appended one column at a time through 1,000:
30 actual graph updates in total. Cells stayed at 60 logical units throughout;
the camera refitted after each update.

| Phase | Median per append | P95 per append |
| --- | ---: | ---: |
| Native construction | 0.22 ms | 6.48 ms |
| Incremental C layout | 0.71 ms | 3.49 ms |
| Full drawing snapshot | 30.55 ms | 64.39 ms |
| Full Qt scene rebuild | 30.14 ms | 37.80 ms |
| Start through frame submission | 93.62 ms | 166.86 ms |

Percentiles use nearest rank over all 30 updates. Timings varied across runs;
the tails include scheduling/allocation effects and are not hard limits.

The append from 999 to 1,000 adds 169 nodes. Layout commits those nodes and
the 999 existing base-row ancestors: **1,168 nodes committed**, with **998
clean subtrees skipped**. Existing factor columns retain their layouts.
This is checked by native tests, not inferred from short timings.

The viewer still extracts every node and rebuilds every scene group after an
append. At this size, those two steps dominate the layout cost and prevent
display-rate updates even though cached panning remains smooth. The next
optimization is to retain unchanged group snapshots and Qt geometry, updating
group transforms and changed groups independently. Culling and label detail
policies are separate possibilities, but were not applied in these measurements.

## Headless growth from 1

`parsegraph_primes_benchmark --repeats 3` measures the C generator and layout
without Qt, text shaping, snapshots, or rendering. Median times across three
runs at a final count of 1,000:

| Mode | Updates | Total construction | Total layout | Committed nodes across all updates |
| --- | ---: | ---: | ---: | ---: |
| Build everything, lay out once | 1 | 14.38 ms | 29.82 ms | 93,041 |
| Append one column, lay out each time | 999 | 18.88 ms | 188.62 ms | 592,540 |
| Append up to ten columns, lay out each batch | 100 | 15.58 ms | 40.54 ms | 142,640 |

Growth totals exclude the initial root-only setup/layout. The median of the
three per-run p95 layout times was 0.36 ms for single-column growth and 0.71 ms
for batches of ten. Batching reduces repeated work along the growing base row.
The viewer and headless numbers come from separate processes/workloads and
should not be compared as a controlled implementation speedup.

## Reproduction and validation

See the [viewer commands and timing definitions](README.md#performance-measurements).
For each cold size, run `--primes N --benchmark OUTPUT.json` three times.
For growth, run `--primes 990 --prime-limit 1000 --growth-steps 10 --benchmark
OUTPUT.json` three times. Run measurements sequentially without concurrent
builds or tests. Raw local results are under the ignored `native/build-qt/`
directory: `primes-native.csv`, `primes-{100,300,1000}-{1,2,3}.json`, and
`primes-growth-{1,2,3}.json`.

All 18 Release CTest checks passed, including TypeScript differential tests,
native growth/cold geometry comparisons, document snapshots, and real Qt
rendering/navigation. The native primes test and all three Qt checks also
passed with AddressSanitizer and UndefinedBehaviorSanitizer. TypeScript
generator parity covers 1,823 nodes across six sizes; Qt document parity
additionally covers labels and group-local drawing geometry. No C layout
bug was found in this work.

## Extended native limit: 10,000

The native generator, viewer, and benchmark now accept up to 10,000, using a
shared maximum and sized prime-table, pending-column, and benchmark-sample
allocations. Routine regression checks cross 1597→1598, where a factor column
first needs a second paint group. The 10,000 sizing limit is checked with a
small graph; the full maximum graph is not part of CI.

This development Mac is an Apple M1 with 8 GiB RAM. A complete count of 10,000
contains 6,564,833 nodes and 31,193 paint groups. Multiplying the node count by
the current 792-byte node and 72-byte label record gives **5.28 GiB** before
extent allocations, pointer arrays, snapshots, GPU geometry, or allocator
overhead. This is a calculated lower bound, not a measured peak. The full-size
viewer was therefore not run on this machine.

Three real viewer runs at 2,000 did complete: **331,253 nodes / 2,402 groups**.
Median cold timings were construction **80.7 ms**, layout **148.6 ms**,
snapshot **260.8 ms**, scene CPU **78.1 ms**, and start through first frame
submission **891.0 ms**. Median camera frame intervals were **26.6–27.0 ms**
across the three runs, with p95 **27.6–37.1 ms** and zero geometry rebuilds.
Unlike the 1,000 case, this larger scene no longer followed the 75 Hz display
rate. Layout and snapshot timing also varied considerably across these runs
on the memory-constrained development machine.

Raw runs are `native/build-qt/primes-2000-{1,2,3}.json`. All 18 Release checks
passed after raising the limit. The native test and a 1,002-column benchmark
also passed ASan/UBSan, exercising more than 1,000 timing samples and the
additional paint-group boundary. `--cold-only` is available for large headless
runs to avoid additionally performing thousands of incremental updates.
