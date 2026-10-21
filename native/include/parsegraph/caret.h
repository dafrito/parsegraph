#ifndef PARSEGRAPH_CARET_H
#define PARSEGRAPH_CARET_H

#include "parsegraph/node.h"

#ifdef __cplusplus
extern "C" {
#endif

#define PG_SHRINK_SCALE 0.85
typedef struct pg_caret pg_caret;

/* Carets borrow nodes: destroying a caret never frees nodes referenced by its
 * origin, stack, or marks, nor any spawned graph nodes. Its own stack and mark
 * storage are freed. The caller owns all nodes, including nodes
 * displaced by connect/spawn. Before freeing nodes, discard/reset any caret
 * references to them. Values remain caller-owned too. No internal locking.
 * new() requires an existing node; clone() starts at the current node with
 * a fresh stack and no marks, matching DirectionCaret.clone(). */
pg_caret *pg_caret_new(pg_node *node);
pg_caret *pg_caret_clone(const pg_caret *caret);
void pg_caret_free(pg_caret *caret);
pg_node *pg_caret_node(const pg_caret *caret);
pg_node *pg_caret_origin(const pg_caret *caret);
pg_node *pg_caret_root(const pg_caret *caret);
pg_node *pg_caret_parent(const pg_caret *caret);
pg_node *pg_caret_at(const pg_caret *caret, pg_direction direction);
bool pg_caret_has(const pg_caret *caret, pg_direction direction);
pg_status pg_caret_move(pg_caret *caret, pg_direction direction);
pg_status pg_caret_move_to(pg_caret *caret, pg_node *node);
pg_status pg_caret_push(pg_caret *caret);
pg_status pg_caret_pop(pg_caret *caret); /* PG_RANGE at the initial frame. */
size_t pg_caret_depth(const pg_caret *caret);

/* Marks copy the key, borrow the node, and replace existing keys. Save and
 * restore are expected O(1), with an O(mark-count) resize when necessary.
 * save_auto returns a caret-owned key valid until that mark is cleared or
 * the caret is freed. Generated decimal IDs are unique within this caret. */
pg_status pg_caret_save(pg_caret *caret, const char *key);
pg_status pg_caret_save_auto(pg_caret *caret, const char **key);
pg_status pg_caret_restore(pg_caret *caret, const char *key);
void pg_caret_clear_save(pg_caret *caret, const char *key);
void pg_caret_clear_saves(pg_caret *caret);

pg_status pg_caret_connect(pg_caret *caret, pg_direction direction, pg_node *node);
pg_status pg_caret_connect_move(pg_caret *caret, pg_direction direction, pg_node *node);
/* PG_DIRECTION_NONE detaches the current node; numeric INWARD (zero) always
 * means the inward edge. Disconnect never destroys a node. */
pg_node *pg_caret_disconnect(pg_caret *caret, pg_direction direction);
/* Creates a caller-owned node. PG_ALIGN_NULL leaves alignment unchanged.
 * New nodes inherit fit and prefer the perpendicular axis. On failure no
 * node is leaked, the graph/current position are unchanged, and out is NULL.
 * Replacement detaches the old child without freeing it. */
pg_status pg_caret_spawn(pg_caret *caret, pg_direction direction, void *value,
                         pg_alignment alignment, pg_node **out);
pg_status pg_caret_spawn_move(pg_caret *caret, pg_direction direction, void *value,
                              pg_alignment alignment, pg_node **out);
void *pg_caret_value(const pg_caret *caret);
void *pg_caret_replace(pg_caret *caret, void *value);
pg_status pg_caret_pull(pg_caret *caret, pg_direction direction);
/* Alignment belongs to an edge's parent. PG_DIRECTION_NONE or the current
 * node's parent direction selects that parent edge. Alignment other than
 * PG_ALIGN_NONE sets the owning parent's fit to EXACT, including when selected
 * from its child. */
pg_status pg_caret_align(pg_caret *caret, pg_direction direction, pg_alignment alignment);
pg_status pg_caret_align_parent(pg_caret *caret, pg_alignment alignment);

/* For target-taking methods, NONE selects the current node and a direction
 * selects its neighbor. A missing neighbor returns PG_RANGE, never silently
 * mutates the current node. is_creased follows TypeScript's isPaintGroup:
 * the root is a paint group even without an explicit crease. */
pg_status pg_caret_crease(pg_caret *caret, pg_direction target);
pg_status pg_caret_uncrease(pg_caret *caret, pg_direction target);
bool pg_caret_is_creased(const pg_caret *caret, pg_direction target);
pg_status pg_caret_shrink(pg_caret *caret, pg_direction target);
pg_status pg_caret_grow(pg_caret *caret, pg_direction target);
pg_status pg_caret_set_fit(pg_caret *caret, pg_direction target, pg_fit fit);
pg_status pg_caret_fit_exact(pg_caret *caret, pg_direction target);
pg_status pg_caret_fit_loose(pg_caret *caret, pg_direction target);
pg_status pg_caret_fit_naive(pg_caret *caret, pg_direction target);

#ifdef __cplusplus
}
#endif
#endif
