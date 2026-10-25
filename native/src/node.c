#include "node_internal.h"

#include <float.h>
#include <math.h>
#include <stdlib.h>

static uint64_t next_id = 1, mutation_epoch = 1, geometry_epoch = 1;
static const pg_direction horizontal_order[6] = {
    PG_INWARD, PG_BACKWARD, PG_FORWARD, PG_DOWNWARD, PG_UPWARD, PG_OUTWARD
};
static const pg_direction vertical_order[6] = {
    PG_INWARD, PG_DOWNWARD, PG_UPWARD, PG_BACKWARD, PG_FORWARD, PG_OUTWARD
};

static bool direction_valid(pg_direction d) { return d >= PG_INWARD && d <= PG_BACKWARD; }
static bool cardinal(pg_direction d) { return d >= PG_DOWNWARD && d <= PG_BACKWARD; }
static pg_edge *parent_edge(const pg_node *n) {
    return n && n->parent ? &n->parent->edges[pg_direction_reverse(n->parent_direction)] : NULL;
}

uint64_t pg_graph_mutation_epoch(void) { return mutation_epoch; }

void pg_node_layout_changed(pg_node *n) {
    if (!n) return;
    n->group_root->group_generation = ++geometry_epoch;
}

void pg_node_invalidate(pg_node *n) {
    if (!n) return;
    ++mutation_epoch;
    do {
        pg_layout_phase previous = n->phase;
        n->phase = PG_LAYOUT_NEEDS_COMMIT;
        if (previous == PG_LAYOUT_NEEDS_COMMIT) break;
        n = n->parent;
    } while (n);
}

pg_node *pg_node_new(void *value) {
    pg_node *n = calloc(1, sizeof(*n));
    if (!n) return NULL;
    n->value = value;
    n->id = next_id++;
    n->parent_direction = PG_DIRECTION_NONE;
    n->sibling_next = n->sibling_prev = n->group_root = n;
    n->fit = PG_FIT_LOOSE;
    n->preferred_axis = PG_PREFERRED_HORIZONTAL;
    n->scale = 1;
    n->phase = PG_LAYOUT_NEEDS_COMMIT;
    n->width = n->height = NAN;
    n->group_x = n->group_y = n->group_scale = NAN;
    n->absolute_x = n->absolute_y = n->absolute_scale = NAN;
    n->group_generation = ++geometry_epoch;
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) {
        n->edges[i].alignment = PG_ALIGN_NULL;
        n->edges[i].overlap = PG_OVERLAP_DEFAULT;
        n->edges[i].x = n->edges[i].y = NAN;
    }
    return n;
}

void *pg_node_value(const pg_node *n) { return n ? n->value : NULL; }
void pg_node_set_value(pg_node *n, void *value) {
    if (n && n->value != value) { n->value = value; pg_node_invalidate(n); }
}
uint64_t pg_node_id(const pg_node *n) { return n ? n->id : 0; }
void pg_node_set_id(pg_node *n, uint64_t id) { if (n) n->id = id; }
pg_node *pg_node_at(const pg_node *n, pg_direction d) {
    if (!n || !direction_valid(d)) return NULL;
    return n->parent && d == n->parent_direction ? n->parent : n->edges[d].node;
}
pg_node *pg_node_child(const pg_node *n, pg_direction d) {
    return n && direction_valid(d) ? n->edges[d].node : NULL;
}
pg_node *pg_node_parent(const pg_node *n) { return n ? n->parent : NULL; }
pg_direction pg_node_parent_direction(const pg_node *n) { return n ? n->parent_direction : PG_DIRECTION_NONE; }
pg_node *pg_node_root(pg_node *n) { while (n && n->parent) n = n->parent; return n; }
bool pg_node_has_children(const pg_node *n) {
    if (!n) return false;
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) if (n->edges[i].node) return true;
    return false;
}
bool pg_node_has_ancestor(const pg_node *n, const pg_node *ancestor) {
    if (!ancestor) return false;
    for (; n; n = n->parent) if (n == ancestor) return true;
    return false;
}
bool pg_node_is_rootlike(const pg_node *n) {
    return n && (!n->parent || n->parent_direction == PG_OUTWARD || n->parent_direction == PG_INWARD);
}

pg_fit pg_node_fit(const pg_node *n) { return n ? n->fit : PG_FIT_NULL; }
pg_status pg_node_set_fit(pg_node *n, pg_fit fit) {
    if (!n || (fit != PG_FIT_LOOSE && fit != PG_FIT_EXACT && fit != PG_FIT_NAIVE)) return PG_INVALID;
    if (n->fit != fit) { n->fit = fit; pg_node_invalidate(n); }
    return PG_OK;
}
double pg_node_scale(const pg_node *n) { return n ? n->scale : NAN; }
pg_status pg_node_set_scale(pg_node *n, double scale) {
    if (!n || !isfinite(scale) || scale <= 0) return PG_INVALID;
    if (n->scale != scale) {
        n->scale = scale;
        if (pg_node_is_paint_group(n)) ++geometry_epoch;
        else pg_node_layout_changed(n);
        pg_node_invalidate(n);
    }
    return PG_OK;
}
bool pg_node_right_to_left(const pg_node *n) { return n && n->right_to_left; }
pg_status pg_node_set_right_to_left(pg_node *n, bool rtl) {
    if (!n) return PG_INVALID;
    if (n->right_to_left != rtl) { n->right_to_left = rtl; pg_node_invalidate(n); }
    return PG_OK;
}

pg_preferred_axis pg_node_preferred_axis(const pg_node *n) {
    return n ? n->preferred_axis : PG_PREFERRED_NULL;
}
pg_preferred_axis pg_node_canonical_preferred_axis(const pg_node *n) {
    if (!n) return PG_PREFERRED_NULL;
    pg_preferred_axis pref = n->preferred_axis;
    if (!n->parent) return pref;
    pg_axis axis = pg_direction_axis(n->parent_direction);
    if (pref == PG_PREFERRED_HORIZONTAL) return axis == PG_HORIZONTAL ? PG_PREFERRED_PARENT : PG_PREFERRED_PERPENDICULAR;
    if (pref == PG_PREFERRED_VERTICAL) return axis == PG_VERTICAL ? PG_PREFERRED_PARENT : PG_PREFERRED_PERPENDICULAR;
    return pref;
}
const pg_direction *pg_node_layout_order(const pg_node *n) {
    if (!n || !n->parent) return !n || n->preferred_axis == PG_PREFERRED_HORIZONTAL || n->preferred_axis == PG_PREFERRED_PERPENDICULAR ? horizontal_order : vertical_order;
    bool horizontal = pg_direction_axis(n->parent_direction) == PG_HORIZONTAL;
    if (pg_node_canonical_preferred_axis(n) == PG_PREFERRED_PERPENDICULAR) horizontal = !horizontal;
    return horizontal ? horizontal_order : vertical_order;
}

static void link_siblings(pg_node *a, pg_node *b) { a->sibling_next = b; b->sibling_prev = a; }
pg_node *pg_node_sibling_next(const pg_node *n) { return n ? n->sibling_next : NULL; }
pg_node *pg_node_sibling_prev(const pg_node *n) { return n ? n->sibling_prev : NULL; }
pg_node *pg_node_sibling_head(pg_node *n) {
    if (!n) return NULL;
    for (;;) {
        const pg_direction *order = pg_node_layout_order(n);
        pg_node *first = NULL;
        for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) {
            pg_node *child = n->edges[order[i]].node;
            if (child && !child->creased) { first = child; break; }
        }
        if (!first) return n;
        n = first;
    }
}
static void remove_subtree_ring(pg_node *n) {
    pg_node *head = pg_node_sibling_head(n);
    link_siblings(head->sibling_prev, n->sibling_next);
    link_siblings(n, head);
}
static void insert_subtree_ring(pg_node *parent, pg_direction d, pg_node *n) {
    const pg_direction *order = pg_node_layout_order(parent);
    pg_node *before = NULL, *after = NULL;
    bool seen = false;
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) {
        if (order[i] == d) { seen = true; continue; }
        pg_node *child = parent->edges[order[i]].node;
        if (!child || child->creased) continue;
        if (!seen) before = child;
        else { after = pg_node_sibling_head(child); break; }
    }
    if (!after) after = parent;
    if (!before) before = after->sibling_prev;
    pg_node *head = pg_node_sibling_head(n);
    link_siblings(before, head);
    link_siblings(n, after);
}
static void assign_group_ring(pg_node *n, pg_node *group) {
    pg_node *current = n;
    do {
        current->group_root = group;
        current->group_seen = current->absolute_seen = 0;
        current = current->sibling_next;
    } while (current != n);
}

static void reorder_children(pg_node *n) {
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) {
        pg_node *child = n->edges[i].node;
        if (child && !child->creased) remove_subtree_ring(child);
    }
    const pg_direction *order = pg_node_layout_order(n);
    pg_node *children[PG_NUM_DIRECTIONS];
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) {
        children[i] = n->edges[i].node;
        if (children[i] && !children[i]->creased) n->edges[i].node = NULL;
    }
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) {
        pg_direction d = order[i];
        pg_node *child = children[d];
        if (child && !child->creased) { n->edges[d].node = child; insert_subtree_ring(n, d, child); }
    }
}

pg_status pg_node_set_preferred_axis(pg_node *n, pg_preferred_axis pref) {
    if (!n || pref < PG_PREFERRED_PARENT || pref > PG_PREFERRED_VERTICAL) return PG_INVALID;
    if (!n->parent && pref != PG_PREFERRED_HORIZONTAL && pref != PG_PREFERRED_VERTICAL) return PG_INVALID;
    if (n->parent) {
        pg_axis axis = pg_direction_axis(n->parent_direction);
        if (pref == PG_PREFERRED_HORIZONTAL) pref = axis == PG_HORIZONTAL ? PG_PREFERRED_PARENT : PG_PREFERRED_PERPENDICULAR;
        else if (pref == PG_PREFERRED_VERTICAL) pref = axis == PG_VERTICAL ? PG_PREFERRED_PARENT : PG_PREFERRED_PERPENDICULAR;
    }
    if (pref == n->preferred_axis) return PG_OK;
    n->preferred_axis = pref;
    /* Only child spans are moved; no relabeling or full-group traversal. */
    reorder_children(n);
    pg_node_invalidate(n);
    return PG_OK;
}
pg_status pg_node_pull(pg_node *n, pg_direction d) {
    if (!n || !direction_valid(d)) return PG_INVALID;
    if (pg_node_is_rootlike(n)) return pg_node_set_preferred_axis(n, pg_direction_axis(d) == PG_VERTICAL ? PG_PREFERRED_VERTICAL : PG_PREFERRED_HORIZONTAL);
    return pg_node_set_preferred_axis(n, pg_direction_axis(d) == pg_direction_axis(n->parent_direction) ? PG_PREFERRED_PARENT : PG_PREFERRED_PERPENDICULAR);
}

pg_node *pg_node_disconnect(pg_node *n, pg_direction d) {
    if (!n) return NULL;
    if (d == PG_DIRECTION_NONE || (n->parent && d == n->parent_direction)) {
        if (!n->parent) return n;
        return pg_node_disconnect(n->parent, pg_direction_reverse(n->parent_direction));
    }
    if (!direction_valid(d)) return NULL;
    pg_node *child = n->edges[d].node;
    if (!child) return NULL;
    const pg_direction *old_order = pg_node_layout_order(child);
    if (!child->creased) {
        remove_subtree_ring(child);
        assign_group_ring(child, child);
    }
    child->parent = NULL;
    child->parent_direction = PG_DIRECTION_NONE;
    n->edges[d].node = NULL;
    /* Relative preferences must become absolute when the parent disappears. */
    bool vertical = pg_direction_axis(d) == PG_VERTICAL;
    if (child->preferred_axis == PG_PREFERRED_PARENT) child->preferred_axis = vertical ? PG_PREFERRED_VERTICAL : PG_PREFERRED_HORIZONTAL;
    else if (child->preferred_axis == PG_PREFERRED_PERPENDICULAR) child->preferred_axis = vertical ? PG_PREFERRED_HORIZONTAL : PG_PREFERRED_VERTICAL;
    if (old_order != pg_node_layout_order(child)) reorder_children(child);
    pg_node_layout_changed(n);
    pg_node_layout_changed(child);
    pg_node_invalidate(n);
    pg_node_invalidate(child);
    return child;
}

pg_status pg_node_connect(pg_node *parent, pg_direction d, pg_node *child) {
    if (!parent || !child || !direction_valid(d) || d == PG_OUTWARD || parent == child || (parent->parent && d == parent->parent_direction)) return PG_INVALID;
    /* A leaf cannot be an ancestor. This keeps long fresh chains O(n). */
    if (pg_node_has_children(child) && pg_node_has_ancestor(parent, child)) return PG_INVALID;
    if (parent->edges[d].node == child) return PG_OK;
    if (parent->edges[d].node) pg_node_disconnect(parent, d);
    if (child->parent) pg_node_disconnect(child, PG_DIRECTION_NONE);
    const pg_direction *old_order = pg_node_layout_order(child);
    pg_direction reverse = pg_direction_reverse(d);
    if (child->edges[reverse].node) pg_node_disconnect(child, reverse);
    if (!child->creased) assign_group_ring(child, parent->group_root);
    parent->edges[d].node = child;
    if (parent->edges[d].alignment == PG_ALIGN_NULL) parent->edges[d].alignment = PG_ALIGN_NONE;
    parent->edges[d].x = parent->edges[d].y = NAN;
    child->parent = parent;
    child->parent_direction = reverse;
    if (old_order != pg_node_layout_order(child)) reorder_children(child);
    if (!child->creased) insert_subtree_ring(parent, d, child);
    /* Changing parent direction changes the child's axis-based layout. */
    pg_node_invalidate(child);
    pg_node_invalidate(parent);
    pg_node_layout_changed(parent);
    return PG_OK;
}

static void destroy_node(pg_node *n) {
    for (unsigned i = 0; i < 4; ++i) pg_extent_destroy(&n->extents[i]);
    free(n);
}
void pg_node_free(pg_node *n) {
    if (!n) return;
    pg_node_disconnect(n, PG_DIRECTION_NONE);
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) if (n->edges[i].node) pg_node_disconnect(n, (pg_direction)i);
    destroy_node(n);
}
void pg_node_free_tree(pg_node *root) {
    if (!root) return;
    pg_node_disconnect(root, PG_DIRECTION_NONE);
    pg_node *n = root;
    while (n) {
        pg_node *child = NULL;
        for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) if (n->edges[i].node) { child = n->edges[i].node; break; }
        if (child) { n = child; continue; }
        pg_node *parent = n->parent;
        if (parent) parent->edges[pg_direction_reverse(n->parent_direction)].node = NULL;
        destroy_node(n);
        n = parent;
    }
    ++mutation_epoch;
    ++geometry_epoch;
}

static pg_edge *edge_at(const pg_node *n, pg_direction d) {
    if (!n) return NULL;
    if (d == PG_DIRECTION_NONE || (n->parent && d == n->parent_direction)) return parent_edge(n);
    return direction_valid(d) ? (pg_edge *)&n->edges[d] : NULL;
}
pg_alignment pg_node_alignment(const pg_node *n, pg_direction d) {
    const pg_edge *edge = edge_at(n, d);
    return edge ? edge->alignment : PG_ALIGN_NULL;
}
pg_status pg_node_set_alignment(pg_node *n, pg_direction d, pg_alignment value) {
    pg_edge *edge = edge_at(n, d);
    if (!edge || value < PG_ALIGN_NULL || value > PG_ALIGN_INWARD_VERTICAL) return PG_INVALID;
    if (edge->alignment != value) {
        edge->alignment = value;
        pg_node_invalidate(d == PG_DIRECTION_NONE || (n->parent && d == n->parent_direction) ? n->parent : n);
    }
    return PG_OK;
}
pg_axis_overlap pg_node_overlap(const pg_node *n, pg_direction d) {
    const pg_edge *edge = edge_at(n, d);
    return edge ? edge->overlap : PG_OVERLAP_NULL;
}
pg_status pg_node_set_overlap(pg_node *n, pg_direction d, pg_axis_overlap value) {
    pg_edge *edge = edge_at(n, d);
    if (!edge || value < PG_OVERLAP_NULL || value > PG_OVERLAP_DEFAULT) return PG_INVALID;
    if (edge->overlap != value) {
        edge->overlap = value;
        pg_node_invalidate(d == PG_DIRECTION_NONE || (n->parent && d == n->parent_direction) ? n->parent : n);
    }
    return PG_OK;
}
double pg_node_separation(const pg_node *n, pg_direction d) {
    const pg_edge *edge = cardinal(d) ? edge_at(n, d) : NULL;
    return edge && edge->node ? edge->separation : NAN;
}
double pg_node_line_length(const pg_node *n, pg_direction d) {
    const pg_edge *edge = edge_at(n, d);
    return edge && edge->node ? edge->line_length : 0;
}
double pg_node_alignment_offset(const pg_node *n, pg_direction d) {
    const pg_edge *edge = edge_at(n, d);
    return edge ? edge->alignment_offset : NAN;
}
pg_status pg_node_child_position(const pg_node *n, pg_direction d, double out[2]) {
    if (!n || !out || !direction_valid(d) || !n->edges[d].node) return PG_INVALID;
    out[0] = n->edges[d].x; out[1] = n->edges[d].y;
    return PG_OK;
}

pg_status pg_node_crease(pg_node *n) {
    if (!n) return PG_INVALID;
    if (n->creased) return PG_OK;
    if (n->parent) {
        remove_subtree_ring(n);
        assign_group_ring(n, n);
        pg_node_layout_changed(n->parent);
    }
    n->creased = true;
    pg_node_layout_changed(n);
    pg_node_invalidate(n);
    return PG_OK;
}
pg_status pg_node_uncrease(pg_node *n) {
    if (!n) return PG_INVALID;
    if (!n->creased) return PG_OK;
    n->creased = false;
    if (n->parent) {
        assign_group_ring(n, n->parent->group_root);
        insert_subtree_ring(n->parent, pg_direction_reverse(n->parent_direction), n);
    }
    pg_node_layout_changed(n);
    pg_node_invalidate(n);
    return PG_OK;
}
bool pg_node_is_creased(const pg_node *n) { return n && n->creased; }
bool pg_node_is_paint_group(const pg_node *n) { return n && (!n->parent || n->creased); }
pg_node *pg_node_paint_group(const pg_node *n) { return n ? n->group_root : NULL; }

pg_node *pg_node_next_preorder(pg_node *n, const pg_node *root) {
    if (!n || !root) return NULL;
    const pg_direction *order = pg_node_layout_order(n);
    for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) if (n->edges[order[i]].node) return n->edges[order[i]].node;
    while (n != root && n->parent) {
        pg_direction d = pg_direction_reverse(n->parent_direction);
        n = n->parent;
        order = pg_node_layout_order(n);
        bool seen = false;
        for (unsigned i = 0; i < PG_NUM_DIRECTIONS; ++i) {
            if (order[i] == d) { seen = true; continue; }
            if (seen && n->edges[order[i]].node) return n->edges[order[i]].node;
        }
    }
    return NULL;
}
pg_node *pg_node_next_paint_group(pg_node *n, const pg_node *root) {
    while ((n = pg_node_next_preorder(n, root))) if (pg_node_is_paint_group(n)) return n;
    return NULL;
}

pg_layout_phase pg_node_phase(const pg_node *n) { return n ? n->phase : PG_LAYOUT_NULL; }
pg_status pg_node_set_size(pg_node *n, double width, double height) {
    if (!n || !isfinite(width) || !isfinite(height) || width < 0 || height < 0 || width > FLT_MAX || height > FLT_MAX) return PG_INVALID;
    if (n->width != width || n->height != height) {
        n->width = width; n->height = height; pg_node_invalidate(n);
    }
    return PG_OK;
}
pg_status pg_node_size(const pg_node *n, double out[2]) {
    if (!n || !out) return PG_INVALID;
    out[0] = n->width; out[1] = n->height;
    return PG_OK;
}
const pg_extent *pg_node_extent(const pg_node *n, pg_direction d) {
    return n && cardinal(d) ? &n->extents[d - PG_DOWNWARD] : NULL;
}

/* Most paths fit the inline stack. Overflow allocation is bounded by depth,
 * never by total graph size; all navigation/destruction is recursion-free. */
static pg_status push_node(pg_node ***stack, pg_node **local, size_t *count,
                           size_t *capacity, pg_node *n) {
    if (*count == *capacity) {
        if (*capacity > SIZE_MAX / (2 * sizeof(pg_node *))) return PG_NOMEM;
        size_t new_capacity = *capacity * 2;
        pg_node **grown = malloc(new_capacity * sizeof(*grown));
        if (!grown) return PG_NOMEM;
        for (size_t i = 0; i < *count; ++i) grown[i] = (*stack)[i];
        if (*stack != local) free(*stack);
        *stack = grown; *capacity = new_capacity;
    }
    (*stack)[(*count)++] = n;
    return PG_OK;
}

static bool valid_transform(double x, double y, double scale) {
    return isfinite(x) && isfinite(y) && isfinite(scale) && scale > 0;
}

pg_status pg_node_group_transform(pg_node *n, pg_transform *out) {
    if (!n || !out) return PG_INVALID;
    pg_node *group = n->group_root;
    uint64_t version = group->group_generation;
    pg_node *local[64], **stack = local, *current = n;
    size_t count = 0, capacity = 64;
    pg_status status = PG_OK;
    while (current != group && current->group_seen != version) {
        status = push_node(&stack, local, &count, &capacity, current);
        if (status != PG_OK) goto done;
        current = current->parent;
        if (!current) { status = PG_INVALID; goto done; }
    }
    if (current == group) {
        current->group_x = current->group_y = 0;
        current->group_scale = 1;
        current->group_seen = version;
    }
    while (count) {
        pg_node *child = stack[--count];
        const pg_edge *edge = parent_edge(child);
        if (!edge || !isfinite(edge->x) || !isfinite(edge->y)) { status = PG_INVALID; goto done; }
        double x = current->group_x + edge->x * current->group_scale;
        double y = current->group_y + edge->y * current->group_scale;
        double scale = current->group_scale * child->scale;
        if (!valid_transform(x, y, scale)) { status = PG_RANGE; goto done; }
        child->group_x = x;
        child->group_y = y;
        child->group_scale = scale;
        child->group_seen = version;
        current = child;
    }
    out->x = n->group_x; out->y = n->group_y; out->scale = n->group_scale;
done:
    if (stack != local) free(stack);
    return status;
}

pg_status pg_node_absolute_transform(pg_node *n, pg_transform *out) {
    if (!n || !out) return PG_INVALID;
    pg_node *group = n->group_root, *current = group;
    pg_node *local[64], **stack = local;
    size_t count = 0, capacity = 64;
    pg_status status = PG_OK;
    while (current->absolute_seen != geometry_epoch) {
        if (!current->parent) {
            current->absolute_x = current->absolute_y = 0;
            current->absolute_scale = 1;
            current->absolute_seen = geometry_epoch;
            break;
        }
        status = push_node(&stack, local, &count, &capacity, current);
        if (status != PG_OK) goto done;
        current = current->parent->group_root;
    }
    while (count) {
        pg_node *child = stack[--count];
        pg_transform parent_pos;
        status = pg_node_group_transform(child->parent, &parent_pos);
        if (status != PG_OK) goto done;
        const pg_edge *edge = parent_edge(child);
        if (!edge || !isfinite(edge->x) || !isfinite(edge->y)) { status = PG_INVALID; goto done; }
        double x = current->absolute_x + current->absolute_scale * (parent_pos.x + parent_pos.scale * edge->x);
        double y = current->absolute_y + current->absolute_scale * (parent_pos.y + parent_pos.scale * edge->y);
        double scale = current->absolute_scale * parent_pos.scale * child->scale;
        if (!valid_transform(x, y, scale)) { status = PG_RANGE; goto done; }
        child->absolute_x = x;
        child->absolute_y = y;
        child->absolute_scale = scale;
        child->absolute_seen = geometry_epoch;
        current = child;
    }
    pg_transform local_pos;
    status = pg_node_group_transform(n, &local_pos);
    if (status != PG_OK) goto done;
    pg_transform result = {
        group->absolute_x + group->absolute_scale * local_pos.x,
        group->absolute_y + group->absolute_scale * local_pos.y,
        group->absolute_scale * local_pos.scale
    };
    if (!valid_transform(result.x, result.y, result.scale)) { status = PG_RANGE; goto done; }
    *out = result;
    if (n != group) {
        n->absolute_x = out->x; n->absolute_y = out->y; n->absolute_scale = out->scale;
        n->absolute_seen = geometry_epoch;
    }
done:
    if (stack != local) free(stack);
    return status;
}

pg_status pg_node_extent_size(pg_node *n, double out[2]) {
    if (!n || !out) return PG_INVALID;
    double bounds[3];
    pg_extent_bounding_values(&n->extents[PG_DOWNWARD - PG_DOWNWARD], bounds); out[0] = bounds[0];
    pg_extent_bounding_values(&n->extents[PG_FORWARD - PG_DOWNWARD], bounds); out[1] = bounds[0];
    return PG_OK;
}
bool pg_node_contains_body(pg_node *n, double x, double y, double user_scale) {
    pg_transform t;
    if (!n || !isfinite(x) || !isfinite(y) || !isfinite(user_scale) || user_scale <= 0 || pg_node_absolute_transform(n, &t) != PG_OK) return false;
    double half_w = user_scale * t.scale * n->width / 2;
    double half_h = user_scale * t.scale * n->height / 2;
    double left = user_scale * t.x - half_w, right = user_scale * t.x + half_w;
    double top = user_scale * t.y - half_h, bottom = user_scale * t.y + half_h;
    if (!isfinite(left) || !isfinite(right) || !isfinite(top) || !isfinite(bottom)) return false;
    return x >= left && x <= right && y >= top && y <= bottom;
}
bool pg_node_contains_extents(pg_node *n, double x, double y, double user_scale) {
    pg_transform t;
    if (!n || !isfinite(x) || !isfinite(y) || !isfinite(user_scale) || user_scale <= 0 || pg_node_absolute_transform(n, &t) != PG_OK) return false;
    double size[2]; pg_node_extent_size(n, size);
    double left = user_scale * (t.x - t.scale * n->extents[PG_DOWNWARD - PG_DOWNWARD].offset);
    double top = user_scale * (t.y - t.scale * n->extents[PG_FORWARD - PG_DOWNWARD].offset);
    double right = left + user_scale * t.scale * size[0];
    double bottom = top + user_scale * t.scale * size[1];
    if (!isfinite(left) || !isfinite(right) || !isfinite(top) || !isfinite(bottom)) return false;
    return x >= left && x <= right && y >= top && y <= bottom;
}
pg_node *pg_node_under_coords(pg_node *root, double x, double y, double user_scale) {
    if (!root || !isfinite(x) || !isfinite(y) || !isfinite(user_scale) || user_scale <= 0) return NULL;
    pg_node *local[64], **stack = local, *result = NULL;
    size_t count = 0, capacity = 64;
    if (push_node(&stack, local, &count, &capacity, root) != PG_OK) return NULL;
    while (count) {
        pg_node *n = stack[--count];
        if (!n) { result = stack[--count]; break; }
        if (pg_node_contains_body(n, x, y, user_scale)) {
            pg_node *inward = n->edges[PG_INWARD].node;
            if (inward && pg_node_contains_extents(inward, x, y, user_scale)) {
                if (push_node(&stack, local, &count, &capacity, n) != PG_OK || push_node(&stack, local, &count, &capacity, NULL) != PG_OK || push_node(&stack, local, &count, &capacity, inward) != PG_OK) break;
                continue;
            }
            result = n; break;
        }
        if (!pg_node_contains_extents(n, x, y, user_scale)) continue;
        pg_transform t;
        if (pg_node_absolute_transform(n, &t) != PG_OK) continue;
        pg_direction dirs[4];
        pg_direction h1 = user_scale * t.x > x ? PG_BACKWARD : PG_FORWARD;
        pg_direction v1 = user_scale * t.y > y ? PG_UPWARD : PG_DOWNWARD;
        if (fabs(y - user_scale * t.y) > fabs(x - user_scale * t.x)) {
            dirs[0] = h1; dirs[1] = pg_direction_reverse(h1); dirs[2] = v1; dirs[3] = pg_direction_reverse(v1);
        } else {
            dirs[0] = v1; dirs[1] = pg_direction_reverse(v1); dirs[2] = h1; dirs[3] = pg_direction_reverse(h1);
        }
        bool failed = false;
        for (unsigned i = 0; i < 4; ++i) {
            pg_node *child = n->edges[dirs[i]].node;
            if (child && push_node(&stack, local, &count, &capacity, child) != PG_OK) { failed = true; break; }
        }
        if (failed) break;
    }
    if (stack != local) free(stack);
    return result;
}

static bool valid_focus(const pg_node *n, pg_focus_mask mask) {
    const pg_focus_mask allowed = PG_FOCUS_INWARD | PG_FOCUS_DOWNWARD |
        PG_FOCUS_UPWARD | PG_FOCUS_FORWARD | PG_FOCUS_BACKWARD;
    return n && !(mask & ~allowed) &&
        (!n->parent || !(mask & (UINT32_C(1) << n->parent_direction)));
}
pg_status pg_node_set_focus(pg_node *n, pg_focus_mask directions) {
    if (!valid_focus(n, directions)) return PG_INVALID;
    n->focus = directions;
    n->has_focus = true;
    return PG_OK;
}
bool pg_node_get_focus(const pg_node *n, pg_focus_mask *out) {
    if (!n || !out || !n->has_focus) return false;
    *out = n->focus;
    return true;
}
void pg_node_clear_focus(pg_node *n) { if (n) n->has_focus = false; }

static pg_status include_body(pg_node *n, pg_bounds *bounds) {
    if (n->phase != PG_LAYOUT_COMMITTED || !isfinite(n->width) || !isfinite(n->height)) return PG_INVALID;
    pg_transform t;
    pg_status status = pg_node_absolute_transform(n, &t);
    if (status != PG_OK) return status;
    double w = n->width * t.scale, h = n->height * t.scale;
    pg_bounds body = {t.x - w / 2, t.y - h / 2, t.x + w / 2, t.y + h / 2};
    if (w < 0 || h < 0 || !isfinite(body.left) || !isfinite(body.top) ||
        !isfinite(body.right) || !isfinite(body.bottom)) return PG_RANGE;
    bounds->left = fmin(bounds->left, body.left);
    bounds->top = fmin(bounds->top, body.top);
    bounds->right = fmax(bounds->right, body.right);
    bounds->bottom = fmax(bounds->bottom, body.bottom);
    return PG_OK;
}
pg_status pg_node_bounds_for_directions(pg_node *n, pg_focus_mask directions, pg_bounds *out) {
    if (!out || !valid_focus(n, directions) || pg_node_root(n)->phase != PG_LAYOUT_COMMITTED) return PG_INVALID;
    pg_bounds bounds = {INFINITY, INFINITY, -INFINITY, -INFINITY};
    pg_status status = include_body(n, &bounds);
    if (status != PG_OK) return status;
    for (int d = PG_INWARD; d <= PG_BACKWARD; ++d) {
        if (!(directions & (UINT32_C(1) << d))) continue;
        pg_node *child = pg_node_child(n, (pg_direction)d);
        for (pg_node *node = child; node; node = pg_node_next_preorder(node, child)) {
            status = include_body(node, &bounds);
            if (status != PG_OK) return status;
        }
    }
    *out = bounds;
    return PG_OK;
}
pg_status pg_node_focus_bounds(pg_node *n, pg_focus_mask fallback, pg_bounds *out) {
    if (!n) return PG_INVALID;
    return pg_node_bounds_for_directions(n, n->has_focus ? n->focus : fallback, out);
}
