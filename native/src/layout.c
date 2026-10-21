#include "parsegraph/layout.h"
#include "node_internal.h"

#include <float.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

/* The native layout uses the same coordinate convention and stage order as
 * CommitLayout: align, separate, position, combine, connector bounds, inward.
 * Traversal is iterative and skips clean subtrees; transforms are lazy in node.c. */
typedef struct layout_frame {
    pg_node *node;
    unsigned next_direction;
} layout_frame;

struct pg_layout {
    pg_node *root;
    pg_layout_painter painter;
    layout_frame *stack;
    size_t depth, capacity;
    uint64_t mutation_epoch;
    pg_layout_metrics metrics;
};

#define TRY(expression) do { pg_status status_ = (expression); \
    if (status_ != PG_OK) return status_; } while (0)

static bool cardinal(pg_direction d) { return d >= PG_DOWNWARD && d <= PG_BACKWARD; }
static bool vertical(pg_direction d) { return d == PG_DOWNWARD || d == PG_UPWARD; }
static pg_direction reverse(pg_direction d) { return (pg_direction)((int)d ^ 1); }
static pg_axis axis_of(pg_direction d) { return vertical(d) ? PG_VERTICAL : PG_HORIZONTAL; }
static pg_direction positive_perpendicular(pg_direction d) {
    return vertical(d) ? PG_FORWARD : PG_DOWNWARD;
}
static int sign_of(pg_direction d) { return d == PG_DOWNWARD || d == PG_FORWARD ? 1 : -1; }
static pg_extent *extent(pg_node *node, pg_direction d) { return &node->extents[d-PG_DOWNWARD]; }
static const pg_extent *const_extent(const pg_node *node, pg_direction d) { return &node->extents[d-PG_DOWNWARD]; }
static pg_node *child(const pg_node *node, pg_direction d) {
    if (d < PG_INWARD || d > PG_BACKWARD || (node->parent && node->parent_direction == d)) return NULL;
    return node->edges[d].node;
}

pg_status pg_layout_consecutive_length(const pg_node *node, pg_direction direction, double *out) {
    if (!node || !out || !cardinal(direction)) return PG_INVALID;
    double total = 0, scale = 1;
    const pg_node *current = node;
    while (current) {
        const pg_node *next;
        double separation;
        if (current->parent && current->parent_direction == direction) {
            next = current->parent;
            separation = next->edges[reverse(direction)].separation;
        } else {
            next = current->edges[direction].node;
            if (!next) break;
            separation = current->edges[direction].separation;
        }
        total += separation * scale;
        scale *= next->scale;
        current = next;
    }
    if (!isfinite(total)) return PG_RANGE;
    *out = total;
    return PG_OK;
}

pg_status pg_layout_alignment(const pg_node *node, pg_direction direction, double *out) {
    if (!node || !out || !cardinal(direction)) return PG_INVALID;
    const pg_node *c = child(node, direction);
    if (!c) return PG_INVALID;
    pg_direction positive = positive_perpendicular(direction);
    double negative_length = 0, positive_length = 0, result;
    switch (node->edges[direction].alignment) {
    case PG_ALIGN_NONE: result = 0; break;
    case PG_ALIGN_NEGATIVE:
        TRY(pg_layout_consecutive_length(c, reverse(positive), &negative_length));
        result = negative_length; break;
    case PG_ALIGN_POSITIVE:
        TRY(pg_layout_consecutive_length(c, positive, &positive_length));
        result = -positive_length; break;
    case PG_ALIGN_CENTER:
        TRY(pg_layout_consecutive_length(c, reverse(positive), &negative_length));
        TRY(pg_layout_consecutive_length(c, positive, &positive_length));
        {
            double half = (negative_length + positive_length)/2;
            result = negative_length > positive_length ? negative_length-half :
                (negative_length < positive_length ? -(positive_length-half) : 0);
        }
        break;
    default: return PG_INVALID;
    }
    result *= c->scale;
    if (!isfinite(result)) return PG_RANGE;
    *out = result;
    return PG_OK;
}

static pg_status spacing(pg_layout *layout, pg_node *node, pg_axis axis,
                         pg_direction direction, bool prefer_vertical, double *out) {
    *out = layout->painter.separation ? layout->painter.separation(node, axis, direction,
        prefer_vertical, layout->painter.context) : 0;
    return isfinite(*out) ? PG_OK : PG_INVALID;
}

static bool overlap(const pg_node *node, pg_direction d, bool fallback) {
    switch (node->edges[d].overlap) {
    case PG_OVERLAP_PREVENTED: return false;
    case PG_OVERLAP_ALLOWED: return true;
    default: return fallback;
    }
}

static pg_status combine_one(pg_node *node, pg_direction child_direction,
                              pg_direction direction, double length_adjustment,
                              double size_adjustment) {
    pg_node *c = child(node, child_direction);
    pg_extent *e = extent(node, direction);
    const pg_extent *ce = const_extent(c, direction);
    double offset = e->offset;
    double displacement = offset + length_adjustment - c->scale * ce->offset;
    if (node->fit == PG_FIT_LOOSE) {
        TRY(pg_extent_combine_simplified(e, e, ce, displacement, size_adjustment, c->scale));
    } else {
        TRY(pg_extent_combine(e, e, ce, displacement, size_adjustment, c->scale));
    }
    /* Extent's C combine deliberately returns offset zero, whereas TypeScript
     * combine preserves this metadata. Restore the parent layout's origin. */
    return pg_extent_set_offset(e, offset + fmax(0, -displacement));
}

static pg_status combine_child(pg_node *node, pg_direction direction,
                                double alignment, double separation) {
    double x = vertical(direction) ? alignment : sign_of(direction)*separation;
    double y = vertical(direction) ? sign_of(direction)*separation : alignment;
    TRY(combine_one(node, direction, PG_DOWNWARD, x, y));
    TRY(combine_one(node, direction, PG_UPWARD, x, -y));
    TRY(combine_one(node, direction, PG_FORWARD, y, x));
    TRY(combine_one(node, direction, PG_BACKWARD, y, -x));
    return PG_OK;
}

static pg_status position_child(pg_node *node, pg_direction direction,
                                 double alignment, double separation) {
    if (!isfinite(separation) || separation < 0) return PG_RANGE;
    pg_node *c = child(node, direction);
    pg_edge *edge = &node->edges[direction];
    double size;
    if (edge->alignment == PG_ALIGN_NONE) {
        size = (vertical(direction) ? c->height : c->width)/2;
    } else {
        const pg_extent *ce = const_extent(c, reverse(direction));
        TRY(pg_extent_size_at(ce, ce->offset - alignment / c->scale, &size));
    }
    edge->alignment_offset = alignment;
    edge->separation = separation;
    edge->line_length = separation - c->scale * size;
    edge->x = vertical(direction) ? alignment : sign_of(direction)*separation;
    edge->y = vertical(direction) ? sign_of(direction)*separation : alignment;
    return PG_OK;
}

static pg_status padded_separation(pg_layout *layout, pg_node *node,
                                    pg_direction d, double *separation) {
    const pg_node *c = child(node, d);
    double child_size = vertical(d) ? c->height : c->width;
    double body_size = vertical(d) ? node->height : node->width;
    double padding;
    TRY(spacing(layout, node, axis_of(d), d, vertical(d), &padding));
    *separation = fmax(*separation, c->scale*child_size/2 + body_size/2) + padding*c->scale;
    return isfinite(*separation) && *separation >= 0 ? PG_OK : PG_RANGE;
}

static pg_status layout_single(pg_layout *layout, pg_node *node,
                               pg_direction d, bool allow_axis_overlap) {
    pg_node *c = child(node, d);
    if (!c) return PG_OK;
    if (c->phase != PG_LAYOUT_COMMITTED) return PG_INVALID;
    double alignment, separation;
    TRY(pg_layout_alignment(node, d, &alignment));
    const pg_extent *e = const_extent(node, d), *ce = const_extent(c, reverse(d));
    TRY(pg_extent_separation(e, ce, e->offset + alignment - c->scale*ce->offset,
                              overlap(node, d, allow_axis_overlap), c->scale, &separation));
    TRY(padded_separation(layout, node, d, &separation));
    TRY(position_child(node, d, alignment, separation));
    return combine_child(node, d, alignment, separation);
}

static pg_status layout_axis(pg_layout *layout, pg_node *node,
                             pg_direction first, pg_direction second,
                             bool allow_axis_overlap) {
    pg_node *a = child(node, first), *b = child(node, second);
    if (!a) return b ? layout_single(layout, node, second, allow_axis_overlap) : PG_OK;
    if (!b) return layout_single(layout, node, first, allow_axis_overlap);
    if (a->phase != PG_LAYOUT_COMMITTED || b->phase != PG_LAYOUT_COMMITTED) return PG_INVALID;
    double a_alignment, b_alignment, between, a_sep, b_sep;
    TRY(pg_layout_alignment(node, first, &a_alignment));
    TRY(pg_layout_alignment(node, second, &b_alignment));
    const pg_extent *ae = const_extent(a, second), *be = const_extent(b, first);
    double ratio = b->scale/a->scale;
    TRY(pg_extent_separation(ae, be,
        (b_alignment-a_alignment)/a->scale + ae->offset-ratio*be->offset,
        true, ratio, &between));
    between *= a->scale;
    const pg_extent *first_extent = const_extent(node, first);
    const pg_extent *second_extent = const_extent(node, second);
    TRY(pg_extent_separation(first_extent, ae,
        first_extent->offset+a_alignment-a->scale*ae->offset,
        overlap(node, first, allow_axis_overlap), a->scale, &a_sep));
    TRY(pg_extent_separation(second_extent, be,
        second_extent->offset+b_alignment-b->scale*be->offset,
        overlap(node, second, allow_axis_overlap), b->scale, &b_sep));
    if (between >= a_sep+b_sep) {
        a_sep = fmax(a_sep, between/2);
        b_sep = fmax(b_sep, between/2);
    }
    TRY(padded_separation(layout, node, first, &a_sep));
    TRY(padded_separation(layout, node, second, &b_sep));
    TRY(position_child(node, first, a_alignment, a_sep));
    TRY(position_child(node, second, b_alignment, b_sep));
    TRY(combine_child(node, first, a_alignment, a_sep));
    return combine_child(node, second, b_alignment, b_sep);
}

static pg_status layout_cardinals(pg_layout *layout, pg_node *node) {
    if (pg_node_is_rootlike(node)) {
        if (node->preferred_axis == PG_PREFERRED_HORIZONTAL ||
            node->preferred_axis == PG_PREFERRED_PERPENDICULAR) {
            TRY(layout_axis(layout, node, PG_BACKWARD, PG_FORWARD,
                !child(node, PG_UPWARD) && !child(node, PG_DOWNWARD)));
            return layout_axis(layout, node, PG_UPWARD, PG_DOWNWARD, true);
        }
        TRY(layout_axis(layout, node, PG_UPWARD, PG_DOWNWARD,
            !child(node, PG_BACKWARD) && !child(node, PG_FORWARD)));
        return layout_axis(layout, node, PG_BACKWARD, PG_FORWARD, true);
    }
    pg_direction positive = positive_perpendicular(node->parent_direction);
    pg_direction negative = reverse(positive), opposite = reverse(node->parent_direction);
    if (pg_node_canonical_preferred_axis(node) == PG_PREFERRED_PERPENDICULAR) {
        TRY(layout_axis(layout, node, negative, positive, false));
        return layout_single(layout, node, opposite, true);
    }
    TRY(layout_single(layout, node, opposite, !child(node, positive) && !child(node, negative)));
    return layout_axis(layout, node, negative, positive, true);
}

static pg_status add_line_bounds(pg_node *node, pg_direction d) {
    if (!child(node, d) || node->fit != PG_FIT_EXACT) return PG_OK;
    pg_direction positive = positive_perpendicular(d), negative = reverse(positive);
    pg_extent *pe = extent(node, positive), *ne = extent(node, negative);
    double positive_offset = pe->offset, negative_offset = ne->offset;
    double line_length = node->edges[d].line_length;
    if (sign_of(d) < 0) {
        double body_half = (vertical(d) ? node->height : node->width)/2;
        positive_offset -= body_half + line_length;
        negative_offset -= body_half + line_length;
    }
    double line_size = (vertical(positive) ? node->height : node->width)/2;
    double saved_positive_offset = pe->offset, saved_negative_offset = ne->offset;
    TRY(pg_extent_combine_bound(pe, positive_offset, line_length, line_size));
    TRY(pg_extent_set_offset(pe, saved_positive_offset));
    TRY(pg_extent_combine_bound(ne, negative_offset, line_length, line_size));
    return pg_extent_set_offset(ne, saved_negative_offset);
}

static pg_status layout_inward(pg_layout *layout, pg_node *node) {
    pg_node *nested = child(node, PG_INWARD);
    if (!nested) return PG_OK;
    if (nested->phase != PG_LAYOUT_COMMITTED) return PG_INVALID;
    double horizontal[3], vertical_bounds[3], padding;
    pg_extent_bounding_values(extent(nested, PG_DOWNWARD), horizontal);
    pg_extent_bounding_values(extent(nested, PG_FORWARD), vertical_bounds);
    double width = horizontal[0], height = vertical_bounds[0];
    double x_offset = extent(nested, PG_DOWNWARD)->offset;
    double y_offset = extent(nested, PG_FORWARD)->offset;
    pg_edge *edge = &node->edges[PG_INWARD];
    bool is_vertical = edge->alignment == PG_ALIGN_INWARD_VERTICAL;
    TRY(spacing(layout, node, PG_Z, PG_INWARD, is_vertical, &padding));
    if (is_vertical) {
        edge->x = nested->scale*(x_offset-width/2);
        edge->y = node->height/2-padding/2+nested->scale*(-height+y_offset);
    } else {
        edge->x = node->width/2-padding/2+nested->scale*(-width+x_offset);
        edge->y = nested->scale*(y_offset-height/2);
    }
    return isfinite(edge->x) && isfinite(edge->y) ? PG_OK : PG_RANGE;
}

static pg_status init_extent(pg_node *node, pg_direction d, double length, double size) {
    pg_extent *e = extent(node, d);
    pg_extent_clear(e);
    TRY(pg_extent_append(e, length, size));
    return pg_extent_set_offset(e, length/2);
}

static bool naive_positions_known(const pg_node *node) {
    /* A newly constructed NAIVE graph still needs initial child positions.
     * Once established, naive fitting retains them across size changes. */
    if (node->parent && !isfinite(node->parent->edges[reverse(node->parent_direction)].x)) return false;
    for (int d = PG_INWARD; d <= PG_BACKWARD; ++d) {
        if (child(node, (pg_direction)d) &&
            (!isfinite(node->edges[d].x) || !isfinite(node->edges[d].y))) return false;
    }
    return true;
}

static pg_status commit_node(pg_layout *layout, pg_node *node) {
    if (node->phase == PG_LAYOUT_COMMITTED) return PG_OK;
    if (node->phase != PG_LAYOUT_NEEDS_COMMIT) return PG_INVALID;
    node->phase = PG_LAYOUT_IN_COMMIT;
    double previous_size[2] = {node->width, node->height};
    double previous_positions[PG_NUM_DIRECTIONS][2];
    for (unsigned d = 0; d < PG_NUM_DIRECTIONS; ++d) {
        previous_positions[d][0] = node->edges[d].x;
        previous_positions[d][1] = node->edges[d].y;
    }
    double size[2] = {node->width, node->height};
    if (layout->painter.measure) {
        ++layout->metrics.nodes_measured;
        TRY(layout->painter.measure(node, size, layout->painter.context));
    }
    if (!isfinite(size[0]) || !isfinite(size[1]) || size[0] < 0 || size[1] < 0 ||
        size[0] > FLT_MAX || size[1] > FLT_MAX) return PG_INVALID;
    node->width = size[0]; node->height = size[1];
    TRY(init_extent(node, PG_DOWNWARD, node->width, node->height/2));
    TRY(init_extent(node, PG_UPWARD, node->width, node->height/2));
    TRY(init_extent(node, PG_FORWARD, node->height, node->width/2));
    TRY(init_extent(node, PG_BACKWARD, node->height, node->width/2));
    if (node->fit != PG_FIT_NAIVE || !naive_positions_known(node)) {
        TRY(layout_cardinals(layout, node));
        for (int d = PG_DOWNWARD; d <= PG_BACKWARD; ++d) TRY(add_line_bounds(node, (pg_direction)d));
        TRY(layout_inward(layout, node));
    }
    node->phase = PG_LAYOUT_COMMITTED;
    /* Recomputing identical geometry must not invalidate a whole paint group's
     * cached local positions. In particular, changing the group's outer scale
     * changes its absolute transform but not its interior coordinate system.
     * Scale setters independently invalidate the coordinate space they affect;
     * a scale-dependent measure callback still causes invalidation here when
     * it actually changes the measured body or relative child positions. */
    bool changed = node->width != previous_size[0] || node->height != previous_size[1];
    for (unsigned d = 0; d < PG_NUM_DIRECTIONS && !changed; ++d) {
        if (child(node, (pg_direction)d) &&
            (node->edges[d].x != previous_positions[d][0] ||
             node->edges[d].y != previous_positions[d][1])) changed = true;
    }
    if (changed) pg_node_layout_changed(node);
    ++layout->metrics.nodes_committed;
    return PG_OK;
}

static pg_status push(pg_layout *layout, pg_node *node) {
    if (layout->depth == layout->capacity) {
        size_t capacity = layout->capacity ? layout->capacity*2 : 32;
        if (capacity < layout->capacity || capacity > SIZE_MAX/sizeof(layout_frame)) return PG_NOMEM;
        layout_frame *stack = realloc(layout->stack, capacity*sizeof(*stack));
        if (!stack) return PG_NOMEM;
        layout->stack = stack; layout->capacity = capacity;
    }
    layout->stack[layout->depth++] = (layout_frame){node, 0};
    return PG_OK;
}

pg_layout *pg_layout_new(pg_node *node, const pg_layout_painter *painter) {
    if (!node) return NULL;
    pg_layout *layout = calloc(1, sizeof(*layout));
    if (!layout) return NULL;
    if (painter) layout->painter = *painter;
    if (pg_layout_reset(layout, node) != PG_OK) { free(layout); return NULL; }
    return layout;
}
void pg_layout_free(pg_layout *layout) {
    if (!layout) return;
    free(layout->stack);
    free(layout);
}
pg_status pg_layout_reset(pg_layout *layout, pg_node *node) {
    if (!layout || !node) return PG_INVALID;
    layout->root = pg_node_root(node);
    layout->depth = 0;
    layout->mutation_epoch = pg_graph_mutation_epoch();
    return PG_OK;
}
pg_node *pg_layout_root(const pg_layout *layout) { return layout ? layout->root : NULL; }

pg_status pg_layout_step(pg_layout *layout, size_t budget, bool *done) {
    if (!layout || !layout->root || !done) return PG_INVALID;
    uint64_t epoch = pg_graph_mutation_epoch();
    if (epoch != layout->mutation_epoch) {
        if (layout->depth) ++layout->metrics.restarts;
        layout->depth = 0;
        layout->root = pg_node_root(layout->root);
        layout->mutation_epoch = epoch;
    }
    if (!layout->depth && layout->root->phase == PG_LAYOUT_COMMITTED) {
        *done = true; return PG_OK;
    }
    *done = false;
    if (!budget) return PG_OK;
    if (!layout->depth) TRY(push(layout, layout->root));
    while (budget && layout->depth) {
        --budget;
        ++layout->metrics.work_units;
        layout_frame *frame = &layout->stack[layout->depth-1];
        if (frame->next_direction < 6) {
            pg_node *c = child(frame->node, (pg_direction)frame->next_direction++);
            if (!c) continue;
            if (c->phase == PG_LAYOUT_COMMITTED) {
                ++layout->metrics.clean_subtrees_skipped;
                continue;
            }
            pg_status status = push(layout, c);
            if (status != PG_OK) {
                /* Retry the edge if allocating the traversal stack failed. */
                --layout->stack[layout->depth-1].next_direction;
                return status;
            }
        } else {
            pg_node *node = frame->node;
            pg_status status = commit_node(layout, node);
            if (status != PG_OK) {
                node->phase = PG_LAYOUT_NEEDS_COMMIT;
                /* A failed commit may have changed some positions before the
                 * failure. Invalidate conservatively so retrying identical
                 * partial geometry cannot accidentally retain stale caches. */
                pg_node_layout_changed(node);
                return status;
            }
            --layout->depth;
            if (pg_graph_mutation_epoch() != layout->mutation_epoch) {
                /* Mutating callbacks are unsupported, but do not retain stale
                 * traversal pointers after detecting property/topology edits. */
                node->phase = PG_LAYOUT_NEEDS_COMMIT;
                layout->depth = 0;
                return PG_INVALID;
            }
        }
    }
    *done = layout->depth == 0;
    return PG_OK;
}
pg_status pg_layout_run(pg_layout *layout) {
    bool done = false;
    while (!done) TRY(pg_layout_step(layout, SIZE_MAX, &done));
    return PG_OK;
}
void pg_layout_get_metrics(const pg_layout *layout, pg_layout_metrics *out) {
    if (layout && out) *out = layout->metrics;
}
void pg_layout_clear_metrics(pg_layout *layout) {
    if (layout) memset(&layout->metrics, 0, sizeof(layout->metrics));
}
