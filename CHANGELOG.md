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
