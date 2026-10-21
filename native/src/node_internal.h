#ifndef PARSEGRAPH_NODE_INTERNAL_H
#define PARSEGRAPH_NODE_INTERNAL_H
#include "parsegraph/node.h"

typedef struct pg_edge {
    pg_node *node;
    pg_alignment alignment;
    pg_axis_overlap overlap;
    double alignment_offset, separation, line_length, x, y;
} pg_edge;

struct pg_node {
    pg_node *parent;
    pg_direction parent_direction; /* From this node toward parent. */
    pg_edge edges[PG_NUM_DIRECTIONS];
    pg_node *sibling_prev, *sibling_next, *group_root;
    void *value;
    uint64_t id;
    pg_fit fit;
    pg_preferred_axis preferred_axis;
    double scale;
    bool right_to_left, creased;
    pg_layout_phase phase;
    double width, height;
    pg_extent extents[4];
    double group_x, group_y, group_scale;
    double absolute_x, absolute_y, absolute_scale;
    uint64_t group_generation, group_seen, absolute_seen;
};

/* Called after edge positions/body/extents are committed. Invalidates local
 * group geometry without touching separately creased descendant interiors. */
void pg_node_layout_changed(pg_node *node);
/* A monotonic mutation epoch lets a suspended layout job reject stale work.
 * Layout-only writes do not increment this epoch. Graphs are single-threaded. */
uint64_t pg_graph_mutation_epoch(void);

#endif
