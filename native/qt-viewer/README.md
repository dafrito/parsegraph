# Qt Quick native viewer

A read-only proof of concept using the C library for layout and Qt Quick for
the window, input, text, and GPU drawing. The bundled proportion study has
196 nodes and comes from the existing TypeScript generator. The primes demo
is generated directly through the C node/caret API, with append-only growth.
The executable
does not need Node.js, a browser, or a server at runtime.

## Build and run

Requires CMake, a C/C++17 toolchain, and Qt 6.7 or newer with Quick, QML, GUI,
Quick Controls, and Quick Dialogs. Tests also use Qt Test. On macOS with Homebrew:

```sh
brew install qtdeclarative
cmake -S native -B native/build-qt \
  -DCMAKE_BUILD_TYPE=Release \
  -DPARSEGRAPH_BUILD_QT_VIEWER=ON \
  -DCMAKE_PREFIX_PATH="$(brew --prefix)"
cmake --build native/build-qt --parallel 4
open native/build-qt/qt-viewer/parsegraph_viewer.app
```

Use your Qt installation's prefix for `CMAKE_PREFIX_PATH` on other platforms.
The executable on Linux is `native/build-qt/qt-viewer/parsegraph_viewer`.
The viewer is off by default; the native library still builds without Qt.
The app bundle currently uses the local Qt installation and is not a standalone
redistributable package.

The ordinary native differential tests require the repository's Node development
dependencies. Pass `-DPARSEGRAPH_TS_PARITY=OFF` to configure without those tests;
the viewer itself does not depend on them. `-DBUILD_TESTING=OFF` omits all tests.

## Using the viewer

- Drag or scroll a trackpad to pan. Scroll a mouse wheel or pinch to zoom.
- Zoom is anchored at the cursor for wheel/pinch input. The +/− buttons zoom
  around the viewport center. Control+trackpad scrolling also zooms.
- Click a node to inspect its document ID and label. Escape clears selection.
- Fit, F, Home, or a double-click fits the graph. Arrow keys pan.
- Groups outlines each paint group's drawing bounds. Extent bounds displays
  the rectangular envelopes of nodes' extents, not their stepped profiles.
- Open or drop a v1 `.parsegraph` file to load another graph.
- Set **Primes through** (1–10,000), then **Build** for a complete graph, or
  **Start at 1** followed by **+1** / **+10** to grow it. The target sets a fixed
  math-cell size for that session; changing digit counts does not resize old
  nodes. Blank cells use a lighter fill so the divisibility pattern is visible.
- The footer reports the last native generation, layout, snapshot, and CPU
  scene-building times. These are separate phases, not a frame-rate estimate.

Generate primes directly, without an intermediate file:

```sh
native/build-qt/qt-viewer/parsegraph_viewer.app/Contents/MacOS/parsegraph_viewer \
  --primes 1000
```

`--prime-limit 1000 --primes 30` starts smaller while allowing growth to 1,000.
Without `--prime-limit`, the initial count is also the sizing/growth limit.
Both options accept counts up to 10,000. This produces 6,564,833 nodes and
31,193 paint groups; the native node/label records alone require about 5.28 GiB
on this ARM64 build, before layout buffers, snapshots, Qt geometry, and allocator
overhead. The full viewer needs substantially more memory. A count of 2,000
already exercises 331,253 nodes and 2,402 groups, including additional creases
within factor columns.

Open the full 30-level, 1,024-node proportion example:

```sh
yarn generate:proportion:v1
native/build-qt/qt-viewer/parsegraph_viewer.app/Contents/MacOS/parsegraph_viewer \
  generated/proportion-v1.parsegraph
```

Save a screenshot and exit (requires a working graphical session):

```sh
native/build-qt/qt-viewer/parsegraph_viewer.app/Contents/MacOS/parsegraph_viewer \
  --snapshot generated/qt-proportion.png
```

`--quit-after MILLISECONDS` is also available for startup smoke checks.
Regenerate the bundled document with the canonical generator:

```sh
./node_modules/.bin/ts-node --project examples/tsconfig.json \
  examples/generators/proportion.ts --count 12 --format v1 \
  --output native/qt-viewer/assets/proportion.parsegraph
```

## Scope and rendering

`GraphDocument` reads the v1 core, `presentation/1`, and `appearance/1`, measures text using Qt,
and runs the C layout algorithm. It validates connections before constructing
them: the C API's tolerant replacement behavior must not silently discard nodes
from malformed documents. String IDs remain opaque app-owned IDs.

The proof of concept supports string/numeric text and missing values. Legacy v0
and other content types are not supported. Unsupported capabilities, including
`generation/1`, are reported in the footer and ignored. There is no saving,
general editing, or regeneration of imported recipes.

`appearance/1` supplies node fills, borders, labels, outgoing connectors, and
the page background, each with independent alpha. Sparse node overrides resolve
against the capability's complete defaults, without inheritance from parents or
presentation style names. A transparent fill does not hide its border or text.
The page background stays fixed to the viewport when the camera moves; its alpha
composites over the host surface (the standalone app uses a light gray surface).
Borders are one node-local unit wide, inset and clamped to the body dimensions,
so decoration does not change layout bounds. These decorations can differ from
the SVG viewer's stroke widths and corner shapes while honoring the same colors.
Malformed supported appearance is rejected. Documents without the capability
retain the native palette.

Open the shared color fixture or generate a colored Rainbow document:

```sh
native/build-qt/qt-viewer/parsegraph_viewer.app/Contents/MacOS/parsegraph_viewer \
  examples/fixtures/appearance-colors.parsegraph
yarn generate:rainbow --count 12 --output generated/native-rainbow.parsegraph
native/build-qt/qt-viewer/parsegraph_viewer.app/Contents/MacOS/parsegraph_viewer \
  generated/native-rainbow.parsegraph
```

The GUI thread creates an immutable drawing snapshot. The render thread only
uses that snapshot: it does not touch the C graph. Each paint group gets a Qt
transform node, batched body/connector vertices, and Qt-managed text nodes.
Camera changes update the outer transform; they do not run layout, rebuild
vertices, or recreate labels. Selection/diagnostic overlays update separately.
This initial renderer loads the whole graph; it has no application-level
visibility index or label level of detail yet. Native primes growth retains
the C graph and incremental layout job, but extracts a full new drawing
snapshot and rebuilds the Qt scene. Paint-group geometry reuse across edits
is a separate next step; camera motion already reuses the scene.

The renderer uses Qt's hardware scene graph (Metal on macOS), not the Qt software
scene-graph adaptation. Extremely large coordinates outside the renderer's
supported float range are reported rather than passed to GPU geometry.

Host font metrics can differ from browser metrics. The proportional vertical
step still keeps the demo's numbered endpoints on a shared baseline. Exact
cross-language geometry tests use the same synthetic text metrics as the
committed fixtures; native text drawing is checked separately.

## Verification

```sh
ctest --test-dir native/build-qt -R '^qt_' --output-on-failure
```

The document test covers the three committed proportion geometry fixtures,
proportional endpoint alignment with actual text metrics, appearance resolution
and validation, and invalid documents.
The viewport test creates a real Qt Quick window, checks rendered pixels,
exercises wheel/drag/select/overlay behavior, and asserts navigation does not
rebuild retained graph geometry. It needs a graphical session; the document test
uses the offscreen platform. Full native tests remain available through CTest.
Appearance checks also inspect rendered pixels for independent fill/border/text
alpha, parent-owned connector color, and page compositing over the host surface.

The native primes tests check topology/divisibility, independent grid geometry,
and incremental versus cold layouts. A TypeScript differential check compares
the native generator with the existing TS generator. Qt tests compare generated
snapshots with the document path, check lifetime/invalid input, and verify that
growth uploads new geometry while panning does not.

## Performance measurements

Use a Release build and a quiet machine. The headless benchmark separates
native construction from layout and compares cold layout with repeated growth:

```sh
native/build-qt/parsegraph_primes_benchmark --repeats 3 \
  > native/build-qt/primes-native.csv
```

For larger counts, use `--cold-only` to measure construction and one layout
without also running thousands of incremental updates:

```sh
native/build-qt/parsegraph_primes_benchmark --count 2000 --cold-only
```

The real viewer can write a JSON report and exit:

```sh
native/build-qt/qt-viewer/parsegraph_viewer.app/Contents/MacOS/parsegraph_viewer \
  --primes 1000 --benchmark native/build-qt/primes-1000.json
native/build-qt/qt-viewer/parsegraph_viewer.app/Contents/MacOS/parsegraph_viewer \
  --primes 990 --prime-limit 1000 --growth-steps 10 \
  --benchmark native/build-qt/primes-growth.json
```

`--frames` defaults to 120 measured camera frames after 10 warmup frames.
The report includes native phase metrics, full snapshot extraction, CPU scene
creation/disposal, elapsed time through frame submission, camera frame interval
percentiles, and each requested growth update. Growth refits the camera to
include the new column. Construction, layout, and snapshot timings exclude
session setup; `totalMs` also includes session setup and drawing-range validation,
but excludes installing the snapshot and rendering. The elapsed submission time
covers those additional steps and frame scheduling; the cold sample also includes
initial graphics initialization.

Scene CPU timing includes vertex/glyph construction and disposal of the previous
scene, but not GPU execution. Frame intervals use render-thread `frameSwapped`
timestamps: a frame has been queued for presentation, not necessarily displayed.
They include display pacing and must not be interpreted as isolated GPU time.
Camera measurements reuse the completed graph; the growth measurements are the
ones that exercise layout and scene updates. See [recorded results](PRIMES_PERFORMANCE.md).
