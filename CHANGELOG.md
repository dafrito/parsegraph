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

TODOs:

- Flesh out documentation
- Ports to Swift, C, C++, Java

MAYBEs:

- Remove Exception
- Remove makeLimit

