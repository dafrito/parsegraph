#ifndef PARSEGRAPH_PAINT_H
#define PARSEGRAPH_PAINT_H

#include "node.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Rectangles use center coordinates and nonnegative dimensions. Painting is
 * headless: callbacks emit geometry only, in the node's paint-group space.
 * Apply the group's absolute transform to flatten into world coordinates.
 * Nodes must have a committed layout (otherwise PG_INVALID). Callbacks must
 * not mutate graph topology, properties, or lifetimes. Nonfinite rectangle
 * coordinates/dimensions return PG_RANGE without emitting that rectangle;
 * earlier rectangles may already have been emitted. */
typedef void (*pg_bounds_painter)(double x, double y, double width, double height,
                                 void *context);
typedef struct pg_rect { double x, y, width, height; } pg_rect;
pg_status pg_paint_node_bounds(pg_node *node, pg_bounds_painter painter, void *context);
pg_status pg_paint_node_lines(pg_node *node, double thickness,
                              pg_bounds_painter painter, void *context);
/* Bounding rectangle of this group's bodies and outgoing cardinal lines.
 * Includes inward bodies; separately creased groups contribute their joining
 * connector but their own bodies are excluded. This is actual drawing bounds,
 * not the descendant-inclusive layout envelope returned by node_extent.
 * Bounds spanning beyond finite double range return PG_RANGE. Output remains
 * unchanged on error. */
pg_status pg_paint_group_bounds(pg_node *group, double thickness, pg_rect *out);

#ifdef __cplusplus
}
#endif
#endif
