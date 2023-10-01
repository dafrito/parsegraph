# Code example:

```
import { 
  CommitLayout,
  DirectionNode,
  paintNodeBounds,
  paintNodeLines,
} from "parsegraph";

// TODO Build a graph.
const rootNode = new DirectionNode("Hello, world");

const layout = new CommitLayout(rootNode, {
  size: (node: DirectionNode, size: number[]) => {
    // TODO Provide the size of the node to the size object.
    // This will be called for every DirectionNode.
    size[0] = 24;
    size[1] = 80;
  }
});

// Commit the layout.
while (layout.crank());

// Render the graph.
rootNode.paintGroup().forEach((pg: DirectionNode) => {
  pg.forEachNode(node => {
    paintNodeLines(node, (x, y, w, h) => {
      // TODO Draw lines from node to neighbor.
    });
    paintNodeBounds(node, (x, y, w, h) => {
      // TODO Draw node.
    });
  });
});

```

# What is parsegraph?

Parsegraph is a platform-independent library to paint a graph of connected
values in up to five directions.

# What is DirectionNode?

A DirectionNode is a class that can have DirectionNode "neighbors" in up to five
directions:

- inward
- upward
- downward
- forward
- backward

A DirectionNode can also hold a value, optionally of a given type.

A DirectionNode maintains a Morris traversal between its neighbors and their
neighbors and so on. This is called a DirectionNode's "siblings".

The connection between two DirectionNodes is parent-child, so there always is a
root DirectionNode for a given DirectionNode. Each neighbor keeps a reference
to its parent DirectionNode.

A DirectionNode also maintains a connection to a parent "paint group" which
allows traversal to other paint groups in a larger graph.

# What is commit layout?

CommitLayout is the algorithm that computes and populates the Layout for a
given DirectionNode and its neighbors.

### Axis

It does this by laying out an axis of two DirectionNodes neighbors that are
across from each other, relative to a parent DirectionNode.

* Z axis (inward)
* Vertical axis (upward and downward)
* Horizontal axis (backward and forward)

### PreferredAxis

The Z axis axis is always laid out before vertical and horizontal axes.

The vertical and horizontal axes are laid out according to the NeighborNode's
PreferredAxis property. The first axis is separated with two neighbors between
only the parent. The second axis is separated - perpendicular to the first axis
- with two neighbors between the combination of the parent and the two
first-axis neighbors. So naturally the second axis will be further from the
parent than the first axis.

The "pull" API on carets and nodes lets the caller specify a direction and
have it converted into the right PreferredAxis.

When pulling in a Direction, that Direction is converted to an Axis. Then, if
the DirectionNode has a parent, then that Axis is compared with the parent axis
to choose between PARENT (the same axis as the parent direction) or
PERPENDICULAR. If the DirectionNode is a root node, either VERTICAL or
HORIZONTAL is used.

When a DirectionNode is disconnected from its parent, and it is using PARENT or
PERPENDICULAR, then that PreferredAxis is converted to VERTICAL or HORIZONTAL
based on what the DirectionNode last was.

* `PreferredAxis.VERTICAL`
* `PreferredAxis.HORIZONTAL`
* `PreferredAxis.PARENT`
* `PreferredAxis.PERPENDICULAR`

###

The layout takes these actions for each axis:

1. It aligns each neighbors relative to each other.
2. It computes a minimum separation distance between each DirectionNode neighbor.
3. It positions each neighbor relative to their parent.
4. It combines the layout of the neighbors and the layout of the parent into a
common group layout.

This is done iteratively for the entire graph, starting with the deepest nodes
first. Every separation and combination is always taking place with fully laid
out descendents, until finally the root and thus the entire graph is laid out.

# Performance

A sufficiently large graph of DirectionNodes will take intolerably long to
immediately render per frame.

## Use PaintGroups

Often it is rare that the entire graph is on-screen at one time, so the graph
can be split into two or more pieces. Since each DirectionNode keeps track of
the size of its content, its easy to see at render time if a DirectionNode or
any of its descendents would be on-screen. If they wouldn't be, then they can
be skipped altogether.

Sometimes many sections of the graph are not changing. In these cases, paint
groups that did not change are not repainted and the paint() callback is not
called when the CommitLayout algorithm is run.

* `DirectionNode.crease` - make the current node a PaintGroup
* `DirectionNode.uncrease` - merge the current node into the parent's paint group


## Use simpler rendering at extreme scales

At render-time, the scale of each paint group can also be used to determine if
or how it is rendered.

You can hook into the CommitLayout's LayoutPainter paint(pg: DirectionNode)
callback and render the every node in the paint group into a single render call
using their group position. Then, at render time, you pass a world matrix to
your render call that is the absolute position of that paint group. Both the
group and the absolute position are computed using the CommitLayout
algorithm.
