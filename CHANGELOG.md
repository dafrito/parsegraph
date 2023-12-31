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
