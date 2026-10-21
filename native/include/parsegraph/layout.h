#ifndef PARSEGRAPH_LAYOUT_H
#define PARSEGRAPH_LAYOUT_H

#include "node.h"
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Renderer-independent layout: callbacks supply body dimensions and spacing.
 * Child layouts are committed before measure is called, so a containing body
 * may size itself from its inward child's extents. Values belong to the caller.
 * Callbacks must not mutate graph topology, properties, or lifetimes. */
typedef struct pg_layout_painter {
    pg_status (*measure)(pg_node *node, double size[2], void *context);
    double (*separation)(pg_node *node, pg_axis axis, pg_direction direction,
                         bool prefer_vertical, void *context);
    void *context;
} pg_layout_painter;

typedef struct pg_layout pg_layout;
typedef struct pg_layout_metrics {
    uint64_t work_units;
    uint64_t nodes_committed;
    uint64_t nodes_measured;
    uint64_t clean_subtrees_skipped;
    uint64_t restarts;
} pg_layout_metrics;

/* The node's graph root is used. The painter is copied, context is borrowed.
 * With no measure callback, the body size previously set on the node is used.
 * The layout and all graph nodes must outlive an active step/run call. Free or
 * reset the layout before destroying the node returned by pg_layout_root().
 * This is the graph root, possibly different from the constructor argument,
 * and may change after reparenting. It must remain alive between calls too. */
pg_layout *pg_layout_new(pg_node *node, const pg_layout_painter *painter);
void pg_layout_free(pg_layout *layout);
pg_status pg_layout_reset(pg_layout *layout, pg_node *node);
pg_node *pg_layout_root(const pg_layout *layout);
/* A work unit scans one child edge or commits one node. Each extent operation
 * is atomic with respect to this budget: it does not impose a wall-clock limit
 * on an individual complex node. Zero budget polls completion without work.
 * Mutations between calls discard the traversal stack and restart safely;
 * already committed subtrees are reused. Errors leave unfinished nodes dirty,
 * allowing correction/retry; previously committed nodes are retained. */
pg_status pg_layout_step(pg_layout *layout, size_t work_budget, bool *done);
pg_status pg_layout_run(pg_layout *layout);
void pg_layout_get_metrics(const pg_layout *layout, pg_layout_metrics *out);
void pg_layout_clear_metrics(pg_layout *layout);

/* Diagnostic helpers, useful to generators and parity/benchmark harnesses. */
pg_status pg_layout_consecutive_length(const pg_node *node,
                                        pg_direction direction, double *out);
pg_status pg_layout_alignment(const pg_node *node,
                              pg_direction child_direction, double *out);

#ifdef __cplusplus
}
#endif
#endif
