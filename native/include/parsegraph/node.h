#ifndef PARSEGRAPH_NODE_H
#define PARSEGRAPH_NODE_H

#include "extent.h"
#include "types.h"
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

typedef struct pg_node pg_node;
typedef struct pg_transform { double x, y, scale; } pg_transform;

/* Nodes own their geometry, never their value or adjacent nodes. NULL-safe
 * destruction detaches surviving neighbors. Tree destruction is explicitly
 * recursive in meaning, implemented iteratively, and frees the node and its descendants.
 * The caller must release any borrowed node/caret references before freeing. */
pg_node *pg_node_new(void *value);
void pg_node_free(pg_node *node);
void pg_node_free_tree(pg_node *node);
void *pg_node_value(const pg_node *node);
void pg_node_set_value(pg_node *node, void *value);
uint64_t pg_node_id(const pg_node *node);
void pg_node_set_id(pg_node *node, uint64_t id);

/* Framing intent is optional, non-layout metadata. A zero mask explicitly
 * selects the body only; unset uses the consumer's fallback. OUTWARD and the
 * current parent direction are invalid. Missing child branches are permitted.
 * Reparenting retains intent; a now-parent-facing selection must be corrected
 * before querying it. Setters validate before replacing the old selection. */
typedef uint32_t pg_focus_mask;
#define PG_FOCUS_INWARD (UINT32_C(1) << PG_INWARD)
#define PG_FOCUS_DOWNWARD (UINT32_C(1) << PG_DOWNWARD)
#define PG_FOCUS_UPWARD (UINT32_C(1) << PG_UPWARD)
#define PG_FOCUS_FORWARD (UINT32_C(1) << PG_FORWARD)
#define PG_FOCUS_BACKWARD (UINT32_C(1) << PG_BACKWARD)
pg_status pg_node_set_focus(pg_node *node, pg_focus_mask directions);
bool pg_node_get_focus(const pg_node *node, pg_focus_mask *out);
void pg_node_clear_focus(pg_node *node);

/* Tight union of bodies in graph coordinates. Includes the current body and
 * all descendants of each selected child; ignores descendants' own focus.
 * Includes INWARD and nested paint groups, but no connector stroke or padding.
 * Requires completed layout. Walks selected subtrees iteratively, with lazy
 * transform resolution. Outputs remain unchanged on any failure. */
typedef struct pg_bounds { double left, top, right, bottom; } pg_bounds;
pg_status pg_node_bounds_for_directions(pg_node *node, pg_focus_mask directions, pg_bounds *out);
pg_status pg_node_focus_bounds(pg_node *node, pg_focus_mask fallback, pg_bounds *out);

/* Replacement and reparenting detach displaced nodes without destroying them.
 * NONE detaches this node from its parent; a parent-facing direction does too.
 * OUTWARD connections, occupied parent directions, and cycles are rejected
 * before changing any connection. New child reverse-direction children also
 * detach; retain handles to all displaced nodes for eventual destruction. */
pg_status pg_node_connect(pg_node *parent, pg_direction direction, pg_node *child);
pg_node *pg_node_disconnect(pg_node *node, pg_direction direction);
pg_node *pg_node_at(const pg_node *node, pg_direction direction);
pg_node *pg_node_child(const pg_node *node, pg_direction direction);
pg_node *pg_node_parent(const pg_node *node);
pg_direction pg_node_parent_direction(const pg_node *node);
pg_node *pg_node_root(pg_node *node);
bool pg_node_has_children(const pg_node *node);
bool pg_node_has_ancestor(const pg_node *node, const pg_node *ancestor);
bool pg_node_is_rootlike(const pg_node *node);

pg_fit pg_node_fit(const pg_node *node);
pg_status pg_node_set_fit(pg_node *node, pg_fit fit);
double pg_node_scale(const pg_node *node);
pg_status pg_node_set_scale(pg_node *node, double scale);
bool pg_node_right_to_left(const pg_node *node);
pg_status pg_node_set_right_to_left(pg_node *node, bool right_to_left);
pg_preferred_axis pg_node_preferred_axis(const pg_node *node);
pg_preferred_axis pg_node_canonical_preferred_axis(const pg_node *node);
pg_status pg_node_set_preferred_axis(pg_node *node, pg_preferred_axis axis);
pg_status pg_node_pull(pg_node *node, pg_direction direction);
const pg_direction *pg_node_layout_order(const pg_node *node); /* Six entries. */
pg_alignment pg_node_alignment(const pg_node *node, pg_direction direction);
pg_status pg_node_set_alignment(pg_node *node, pg_direction direction,
                                pg_alignment alignment);
pg_axis_overlap pg_node_overlap(const pg_node *node, pg_direction direction);
pg_status pg_node_set_overlap(pg_node *node, pg_direction direction,
                              pg_axis_overlap overlap);
double pg_node_separation(const pg_node *node, pg_direction direction);
double pg_node_line_length(const pg_node *node, pg_direction direction);
double pg_node_alignment_offset(const pg_node *node, pg_direction direction);
pg_status pg_node_child_position(const pg_node *node, pg_direction direction,
                                 double out[2]);

pg_status pg_node_crease(pg_node *node);
pg_status pg_node_uncrease(pg_node *node);
bool pg_node_is_creased(const pg_node *node);
bool pg_node_is_paint_group(const pg_node *node);
pg_node *pg_node_paint_group(const pg_node *node);
/* Intrusive circular postorder list within this node's paint group. next()
 * visits children before their parent; prev() walks in the reverse order. */
pg_node *pg_node_sibling_next(const pg_node *node);
pg_node *pg_node_sibling_prev(const pg_node *node);
pg_node *pg_node_sibling_head(pg_node *node);
/* Iterative traversal helpers, NULL at the end. Paint-group traversal returns
 * the groups in tree preorder; next can scan ordinary nodes between groups. */
pg_node *pg_node_next_preorder(pg_node *node, const pg_node *root);
pg_node *pg_node_next_paint_group(pg_node *node, const pg_node *root);

/* Query geometry after completed layout. Dirty nodes may retain old geometry.
 * Extent pointers borrow node storage and must not survive mutation/free. */
void pg_node_invalidate(pg_node *node);
pg_layout_phase pg_node_phase(const pg_node *node);
/* Default sizing when the layout painter has no measure callback. */
pg_status pg_node_set_size(pg_node *node, double width, double height);
pg_status pg_node_size(const pg_node *node, double out[2]);
const pg_extent *pg_node_extent(const pg_node *node, pg_direction direction);
/* Transform arithmetic overflow, or scale underflow to zero, returns PG_RANGE.
 * Outputs remain unchanged on failure; a corrected graph can be retried. */
pg_status pg_node_group_transform(pg_node *node, pg_transform *out);
pg_status pg_node_absolute_transform(pg_node *node, pg_transform *out);
pg_status pg_node_extent_size(pg_node *node, double out[2]);
bool pg_node_contains_body(pg_node *node, double x, double y, double user_scale);
bool pg_node_contains_extents(pg_node *node, double x, double y, double user_scale);
pg_node *pg_node_under_coords(pg_node *node, double x, double y, double user_scale);

#ifdef __cplusplus
}
#endif
#endif
