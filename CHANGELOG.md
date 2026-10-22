## version 7.0.1

- Use npm's registry transport for the release existence check. The Node fetch
  lookup timed out in both attempts to publish 7.0.0, before npm publication.
- Retain the published `v7.0.0` GitHub tag and its verified artifacts; 7.0.0 was
  not published to npm. This patch release contains the same layout library.

## version 7.0.0

Enhancements:

- Add v1 document APIs with presentation, appearance, and seeded-generation
  capabilities, while retaining the legacy v0 serialization APIs.
- Add standalone proportion, Ulam, primes, Memory Piers, and rainbow generators,
  a reference SVG exporter, and verified local preview packages.
- Add a headless C layout port with TypeScript parity tests and benchmarks, plus
  an optional Qt Quick viewer with presentation/appearance support and an
  incremental primes demo. Native builds are separate from the npm package.
- Add JavaScript and native CI workflows, verified npm archives, and publication
  from manually published GitHub Releases.

Bug fixes:

- Correct Extent buffer growth, ownership transfer, separation, and equality.
- Correct Caret direction/alignment handling, inward reparenting, naive layout,
  scaled-subtree separation, and paint-group ordering. These fixes can change
  geometry for graphs affected by the previous layout bugs.
- Repair dependency-graph SVG generation and production archive staging.

Compatibility:

- The npm major version does not change the `.parsegraph` v1 format or capability
  versions. Existing v0 serialization APIs remain available.
- Geometry can change for graphs affected by the corrected layout bugs above.
- The npm package contains the JavaScript layout library and TypeScript
  declarations, with reference sources, specifications, and examples. Native C
  and Qt artifacts are distributed separately.
- The existing UMD/CommonJS entry point is retained. Browser bundlers can use
  named imports from `parsegraph`; Node CommonJS consumers can use `require`.

## version 6.2.0

Bug fixes:

-  Fix using setLayoutPreference on an INWARD node

## version 6.1.8

Enhancements:

Pipeline now automatically deploys docs to parsegraph.com

## version 6.1.7

Bug fixes:

- Fixed case where nodeAt could throw on missing node even though it's not supposed to

## version 6.1.6

Bug fixes:

- Fixed case where setLayoutPreference would create a malformed layout (by
  including paint groups as siblings)

## version 6.1.4

Bug fixes:

- Remove axisMinimum for testing; this has not properly worked and doesn't seem necessary

## version 6.1.3

Bug fixes:

- Fixed deserializeParsegraph not setting ID

## version 6.1.0

New Parsegraph JSON data format that supports nesting the parsegraph in a
`__parsegraph` field. The intent is to allow for custom additions to the
parsegraph without interfering with parsing the graph.

## version 6.0.1

- Fixed demo's use of paintNodeLines, pg.siblings().forEach
- Make initial node ID's more unique, but still not UUIDs
- Add serializeParsegraph, deserializeParsegraph
- Renamed siblings().forEachNode to siblings().forEach

## version 5.0.0

Fixed caret.root to return caret.node.neighbors.root and not the first node the
caret used.

## version 4.0.0

October 3, 2023 release

Removing non-essential classes and functions:

- Removed Exception
- Removed Size
- Removed Rect
- Removed exposing some functions that are internally used by algorithms
- Removed some function overloading/arguments usage
- Made many private fields actually private
- Removed caret's creased() - just use isCreased()
- Removed moveToRoot; moveTo now takes a DirectionNode to jump to. Added origin that can be used to reproduce moveToRoot
- Moved some methods into Neighbor from Neighbors or DirectionNode
- Moved PaintGroups files into their own folder

## version 3.0.4

more build improvements

## version 3.0.2, 3.0.3

October 1, 2023 release

Build changes


## version 3.0.0

October 1, 2023 release

Major internal refactors from prior versions. The external API changed a bit,
enough to warrant a major version bump.

 - forEachPaintGroup is now paintGroup().forEach
 - DirectionNodeState is merged into DirectionNode
 - many methods relating to neighbors have been moved into Neighbors class
 - NeighborData renamed to Neighbor
 - DirectionNodePaintGroup renamed to PaintGroup


## version 2.0.20 

This is a fork of parsegraph-layout that is designed to be as
platform-independent as possible. The caret API is kept as-is. The node APIs
are merged and simplified, taking advantage of the "externalization" of the
artist into the commit layout caller.

This is a big change as most of the "parsegraph-*" code was renderer-related,
though painting and interaction code was mixed in. The point was that layout
code was no longer mixed in, so this project became the formalization of that
natural boundary.

This API provides DirectionNodes and a way for you to draw them. It achieves
platform-independence because it does not rely on any external APIs, including
timing or graphics APIs. It is left entirely to the caller to provide these.
