# Qt Quick native viewer

A read-only proof of concept using the C library for layout and Qt Quick for
the window, input, text, and GPU drawing. The bundled proportion study has
196 nodes and comes from the existing TypeScript generator. The executable
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

`GraphDocument` reads the v1 core and `presentation/1`, measures text using Qt,
and runs the C layout algorithm. It validates connections before constructing
them: the C API's tolerant replacement behavior must not silently discard nodes
from malformed documents. String IDs remain opaque app-owned IDs.

The proof of concept supports string/numeric text and missing values. Legacy v0
and other content types are not supported. Unsupported capabilities are reported
in the footer and ignored, including `appearance/1` for now; the viewer uses its
own palette. There is no saving, editing, or regeneration of generator recipes.

The GUI thread creates an immutable drawing snapshot. The render thread only
uses that snapshot: it does not touch the C graph. Each paint group gets a Qt
transform node, batched body/connector vertices, and Qt-managed text nodes.
Camera changes update the outer transform; they do not run layout, rebuild
vertices, or recreate labels. Selection/diagnostic overlays update separately.
This initial renderer loads the whole graph; it has no application-level
visibility index, label level of detail, or incremental document editing yet.

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
proportional endpoint alignment with actual text metrics, and invalid documents.
The viewport test creates a real Qt Quick window, checks rendered pixels,
exercises wheel/drag/select/overlay behavior, and asserts navigation does not
rebuild retained graph geometry. It needs a graphical session; the document test
uses the offscreen platform. Full native tests remain available through CTest.
