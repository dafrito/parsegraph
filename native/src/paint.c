#include "parsegraph/paint.h"
#include <math.h>

static pg_status emit_rect(double x, double y, double width, double height,
                           pg_bounds_painter painter, void *ctx) {
    if (!isfinite(x) || !isfinite(y) || !isfinite(width) || !isfinite(height) ||
        width < 0 || height < 0) return PG_RANGE;
    painter(x, y, width, height, ctx);
    return PG_OK;
}

pg_status pg_paint_node_bounds(pg_node *node, pg_bounds_painter painter, void *ctx) {
    if (!node || !painter || pg_node_phase(node) != PG_LAYOUT_COMMITTED) return PG_INVALID;
    pg_transform t;
    double size[2];
    pg_status s = pg_node_group_transform(node, &t);
    if (s != PG_OK) return s;
    s = pg_node_size(node, size);
    if (s != PG_OK) return s;
    return emit_rect(t.x, t.y, size[0] * t.scale, size[1] * t.scale, painter, ctx);
}

pg_status pg_paint_node_lines(pg_node *node, double thickness,
                              pg_bounds_painter painter, void *ctx) {
    if (!node || !painter || pg_node_phase(node) != PG_LAYOUT_COMMITTED) return PG_INVALID;
    if (!isfinite(thickness) || thickness < 0) return PG_RANGE;
    pg_transform parent;
    double size[2];
    pg_status s = pg_node_group_transform(node, &parent);
    if (s != PG_OK) return s;
    s = pg_node_size(node, size);
    if (s != PG_OK) return s;
    for (size_t i = 0; i < PG_NUM_CARDINAL_DIRECTIONS; ++i) {
        pg_direction d = pg_cardinal_directions[i];
        pg_node *child = pg_node_child(node, d);
        if (!child) continue;
        pg_transform ct;
        s = pg_node_group_transform(child, &ct);
        if (s != PG_OK) return s;
        const bool vertical = pg_direction_is_vertical(d);
        const double half = size[vertical ? 1 : 0] / 2;
        const double sign = pg_direction_sign(d);
        const double length = sign * parent.scale *
            (pg_node_line_length(node, d) - half);
        const double offset = length / 2 + parent.scale * sign * half;
        if (vertical) s = emit_rect(parent.x, parent.y + offset,
                                     thickness * ct.scale, fabs(length), painter, ctx);
        else s = emit_rect(parent.x + offset, parent.y,
                            fabs(length), thickness * ct.scale, painter, ctx);
        if (s != PG_OK) return s;
    }
    return PG_OK;
}

typedef struct bounds_accumulator { double left, top, right, bottom; bool valid; } bounds_accumulator;
static void include_rect(double x, double y, double w, double h, void *ctx) {
    bounds_accumulator *b = ctx;
    double left = x-w/2, right = x+w/2, top = y-h/2, bottom = y+h/2;
    if (!isfinite(left) || !isfinite(right) || !isfinite(top) || !isfinite(bottom)) {
        b->valid = false;
        return;
    }
    b->left = fmin(b->left, left);
    b->right = fmax(b->right, right);
    b->top = fmin(b->top, top);
    b->bottom = fmax(b->bottom, bottom);
}
pg_status pg_paint_group_bounds(pg_node *group, double thickness, pg_rect *out) {
    if (!group || !out || !pg_node_is_paint_group(group)) return PG_INVALID;
    if (!isfinite(thickness) || thickness < 0) return PG_RANGE;
    bounds_accumulator b = {INFINITY, INFINITY, -INFINITY, -INFINITY, true};
    pg_node *node = group;
    do {
        pg_status s = pg_paint_node_bounds(node, include_rect, &b);
        if (s != PG_OK) return s;
        if (!b.valid) return PG_RANGE;
        s = pg_paint_node_lines(node, thickness, include_rect, &b);
        if (s != PG_OK) return s;
        if (!b.valid) return PG_RANGE;
        node = pg_node_sibling_next(node);
    } while (node != group);
    double width = b.right-b.left, height = b.bottom-b.top;
    if (!isfinite(width) || !isfinite(height)) return PG_RANGE;
    *out = (pg_rect){b.left+width/2, b.top+height/2, width, height};
    return PG_OK;
}
