#include "parsegraph/paint.h"
#include "parsegraph/layout.h"

#include <assert.h>
#include <float.h>
#include <math.h>
#include <stdio.h>

typedef struct capture { pg_rect rectangles[16]; size_t count; } capture;
static void record(double x, double y, double width, double height, void *context) {
    capture *c = context;
    assert(c->count < 16);
    assert(isfinite(x) && isfinite(y) && isfinite(width) && isfinite(height));
    assert(width >= 0 && height >= 0);
    c->rectangles[c->count++] = (pg_rect){x, y, width, height};
}
static pg_node *make_node(double width, double height) {
    pg_node *n = pg_node_new(NULL);
    assert(n && pg_node_set_size(n, width, height) == PG_OK);
    return n;
}
static void check_rect(pg_rect actual, double x, double y, double width, double height) {
    assert(fabs(actual.x-x) < 1e-9 && fabs(actual.y-y) < 1e-9);
    assert(fabs(actual.width-width) < 1e-9 && fabs(actual.height-height) < 1e-9);
}

static void normal_and_group_bounds(void) {
    pg_node *root = make_node(20, 10), *child = make_node(30, 40);
    assert(pg_node_connect(root, PG_FORWARD, child) == PG_OK);
    pg_layout *layout = pg_layout_new(root, NULL);
    assert(layout && pg_layout_run(layout) == PG_OK);
    capture c = {0};
    assert(pg_paint_node_bounds(root, record, &c) == PG_OK);
    assert(pg_paint_node_bounds(child, record, &c) == PG_OK);
    assert(c.count == 2);
    check_rect(c.rectangles[0], 0, 0, 20, 10);
    check_rect(c.rectangles[1], 25, 0, 30, 40);
    pg_rect bounds;
    assert(pg_paint_group_bounds(root, 1, &bounds) == PG_OK);
    check_rect(bounds, 15, 0, 50, 40);
    assert(pg_node_crease(child) == PG_OK);
    assert(pg_layout_run(layout) == PG_OK);
    c.count = 0;
    assert(pg_paint_node_bounds(child, record, &c) == PG_OK);
    check_rect(c.rectangles[0], 0, 0, 30, 40);
    assert(pg_paint_group_bounds(child, 1, &bounds) == PG_OK);
    check_rect(bounds, 0, 0, 30, 40);
    assert(pg_paint_group_bounds(root, 1, &bounds) == PG_OK);
    check_rect(bounds, 0, 0, 20, 10);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void invalid_inputs(void) {
    pg_node *root = make_node(20, 10);
    capture c = {0};
    /* The documented committed-layout precondition is checked at the API. */
    assert(pg_paint_node_bounds(root, record, &c) == PG_INVALID);
    assert(c.count == 0);
    pg_layout *layout = pg_layout_new(root, NULL);
    assert(layout && pg_layout_run(layout) == PG_OK);
    pg_rect untouched = {1, 2, 3, 4}, out = untouched;
    assert(pg_paint_node_bounds(NULL, record, &c) == PG_INVALID);
    assert(pg_paint_node_bounds(root, NULL, &c) == PG_INVALID);
    assert(pg_paint_node_lines(root, NAN, record, &c) == PG_RANGE);
    assert(pg_paint_node_lines(root, INFINITY, record, &c) == PG_RANGE);
    assert(pg_paint_node_lines(root, -1, record, &c) == PG_RANGE);
    assert(pg_paint_group_bounds(root, INFINITY, &out) == PG_RANGE);
    check_rect(out, untouched.x, untouched.y, untouched.width, untouched.height);
    assert(c.count == 0);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void overflow_does_not_emit(void) {
    /* An inward child's extent does not get combined into its parent's
     * outline, so large finite scales can produce a committed layout while
     * products used for rendering overflow. */
    pg_node *root = make_node(1, 1), *child = make_node(4, 1);
    assert(pg_node_connect(root, PG_INWARD, child) == PG_OK);
    assert(pg_node_set_alignment(root, PG_INWARD, PG_ALIGN_INWARD_VERTICAL) == PG_OK);
    assert(pg_node_set_scale(child, DBL_MAX/2) == PG_OK);
    pg_layout *layout = pg_layout_new(root, NULL);
    assert(layout && pg_layout_run(layout) == PG_OK);
    capture c = {0};
    assert(pg_paint_node_bounds(child, record, &c) == PG_RANGE);
    assert(c.count == 0);
    pg_rect out = {1, 2, 3, 4};
    assert(pg_paint_group_bounds(root, 1, &out) == PG_RANGE);
    check_rect(out, 1, 2, 3, 4);
    /* Recovery must not leave poisoned transform/render caches. */
    assert(pg_node_set_scale(child, 2) == PG_OK);
    assert(pg_layout_run(layout) == PG_OK);
    assert(pg_paint_node_bounds(child, record, &c) == PG_OK && c.count == 1);
    pg_layout_free(layout); pg_node_free_tree(root);

    root = make_node(1, 1); child = make_node(1, 1);
    assert(pg_node_connect(root, PG_FORWARD, child) == PG_OK);
    assert(pg_node_set_scale(child, 2) == PG_OK);
    layout = pg_layout_new(root, NULL);
    assert(layout && pg_layout_run(layout) == PG_OK);
    c.count = 0;
    assert(pg_paint_node_lines(root, DBL_MAX, record, &c) == PG_RANGE);
    assert(c.count == 0);
    assert(pg_paint_node_lines(root, 1, record, &c) == PG_OK && c.count == 1);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static double wide_gap(pg_node *n, pg_axis axis, pg_direction d, bool v, void *ctx) {
    (void)n; (void)d; (void)v; (void)ctx;
    return axis == PG_Z ? 0 : 3;
}
static void bounding_span_overflow(void) {
    /* Every rectangle is finite, but the distance between the opposing
     * leaves exceeds double's range. The bounds API must reject the span. */
    pg_node *root = make_node(1, 1), *a = make_node(1, 1);
    pg_node *b = make_node(0, 0), *c = make_node(0, 0);
    assert(pg_node_connect(root, PG_INWARD, a) == PG_OK);
    assert(pg_node_connect(a, PG_FORWARD, b) == PG_OK);
    assert(pg_node_connect(a, PG_BACKWARD, c) == PG_OK);
    assert(pg_node_set_scale(a, DBL_MAX/4) == PG_OK);
    assert(pg_node_set_alignment(root, PG_INWARD, PG_ALIGN_INWARD_VERTICAL) == PG_OK);
    pg_layout_painter painter = {NULL, wide_gap, NULL};
    pg_layout *layout = pg_layout_new(root, &painter);
    assert(layout && pg_layout_run(layout) == PG_OK);
    capture captured = {0};
    assert(pg_paint_node_bounds(b, record, &captured) == PG_OK);
    assert(pg_paint_node_bounds(c, record, &captured) == PG_OK);
    assert(captured.count == 2);
    pg_rect bounds = {1, 2, 3, 4};
    assert(pg_paint_group_bounds(root, 0, &bounds) == PG_RANGE);
    check_rect(bounds, 1, 2, 3, 4);
    pg_layout_free(layout); pg_node_free_tree(root);
}

int main(void) {
    normal_and_group_bounds(); invalid_inputs(); overflow_does_not_emit(); bounding_span_overflow();
    puts("paint: finite body/line geometry, group bounds, invalid inputs, overflow, and recovery passed");
    return 0;
}
