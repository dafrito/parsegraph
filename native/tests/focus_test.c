#include "parsegraph/caret.h"
#include "parsegraph/layout.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

#define OK(expr) assert((expr) == PG_OK)
static void equal(pg_bounds a, pg_bounds b) {
    assert(fabs(a.left - b.left) < 1e-8);
    assert(fabs(a.top - b.top) < 1e-8);
    assert(fabs(a.right - b.right) < 1e-8);
    assert(fabs(a.bottom - b.bottom) < 1e-8);
}
static pg_bounds bodies(pg_node **nodes, size_t count) {
    pg_bounds r = {INFINITY, INFINITY, -INFINITY, -INFINITY};
    for (size_t i = 0; i < count; ++i) {
        pg_transform t; double size[2];
        OK(pg_node_absolute_transform(nodes[i], &t)); OK(pg_node_size(nodes[i], size));
        r.left = fmin(r.left, t.x-size[0]*t.scale/2);
        r.top = fmin(r.top, t.y-size[1]*t.scale/2);
        r.right = fmax(r.right, t.x+size[0]*t.scale/2);
        r.bottom = fmax(r.bottom, t.y+size[1]*t.scale/2);
    }
    return r;
}
static double gap(pg_node *n, pg_axis a, pg_direction d, bool p, void *ctx) {
    (void)n; (void)a; (void)d; (void)p; (void)ctx; return 4;
}
int main(int argc, char **argv) {
    pg_node *n[6];
    for (int i = 0; i < 6; ++i) {
        n[i] = pg_node_new(NULL); assert(n[i]);
        OK(pg_node_set_size(n[i], 20+i*4, 10+i*2));
    }
    OK(pg_node_connect(n[0], PG_DOWNWARD, n[1]));
    OK(pg_node_connect(n[0], PG_UPWARD, n[2]));
    OK(pg_node_connect(n[0], PG_FORWARD, n[3]));
    OK(pg_node_connect(n[1], PG_FORWARD, n[4]));
    OK(pg_node_connect(n[4], PG_INWARD, n[5]));
    OK(pg_node_set_scale(n[1], .5)); OK(pg_node_set_scale(n[4], 2)); OK(pg_node_set_scale(n[5], .25));
    OK(pg_node_crease(n[1])); OK(pg_node_crease(n[4]));
    pg_layout_painter painter = {NULL, gap, NULL};
    pg_layout *layout = pg_layout_new(n[0], &painter); assert(layout);
    pg_bounds r = {1,2,3,4}, sentinel = r;
    assert(pg_node_bounds_for_directions(n[0], 0, &r) == PG_INVALID); equal(r, sentinel);
    OK(pg_layout_run(layout));
    pg_caret *c = pg_caret_new(n[0]); assert(c);
    pg_focus_mask mask = 999;
    assert(!pg_node_get_focus(n[0], &mask)); assert(mask == 999);
    OK(pg_caret_set_focus(c, PG_FOCUS_DOWNWARD | PG_FOCUS_UPWARD));
    OK(pg_node_set_focus(n[1], 0)); /* Descendant focus does not prune content. */
    pg_node *selected[] = {n[0],n[1],n[2],n[4],n[5]};
    OK(pg_node_focus_bounds(n[0], 0, &r)); equal(r, bodies(selected, 5));
    if (argc > 1 && strcmp(argv[1], "--json") == 0) {
        for (int i = 0; i < 6; ++i) {
            for (pg_focus_mask selection = 0; selection < 64; ++selection) {
                pg_bounds b;
                if (pg_node_bounds_for_directions(n[i], selection, &b) == PG_OK)
                    printf("{\"node\":%d,\"mask\":%u,\"bounds\":[%.17g,%.17g,%.17g,%.17g]}\n",
                        i, (unsigned)selection, b.left,b.top,b.right,b.bottom);
            }
        }
    }
    pg_node *inward[] = {n[4],n[5]};
    OK(pg_node_bounds_for_directions(n[4], PG_FOCUS_INWARD, &r)); equal(r,bodies(inward,2));
    OK(pg_node_bounds_for_directions(n[0], PG_FOCUS_BACKWARD, &r)); equal(r,bodies(n,1));
    OK(pg_caret_set_focus(c, 0));
    OK(pg_node_focus_bounds(n[0], PG_FOCUS_DOWNWARD, &r)); equal(r,bodies(n,1));
    pg_caret_clear_focus(c);
    pg_node *down[] = {n[0],n[1],n[4],n[5]};
    OK(pg_node_focus_bounds(n[0], PG_FOCUS_DOWNWARD, &r)); equal(r,bodies(down,4));
    OK(pg_caret_set_focus(c, PG_FOCUS_UPWARD));
    OK(pg_caret_move(c, PG_DOWNWARD)); OK(pg_caret_set_focus(c, PG_FOCUS_FORWARD));
    assert(pg_node_get_focus(n[0], &mask) && mask == PG_FOCUS_UPWARD);
    assert(pg_node_set_focus(n[1], PG_FOCUS_UPWARD) == PG_INVALID);
    assert(pg_node_set_focus(n[1], UINT32_MAX) == PG_INVALID);
    assert(pg_node_set_focus(n[1], UINT32_C(1) << PG_OUTWARD) == PG_INVALID);
    assert(pg_node_get_focus(n[1], &mask) && mask == PG_FOCUS_FORWARD);
    for (int i = 0; i < 6; ++i) assert(pg_node_phase(n[i]) == PG_LAYOUT_COMMITTED);
    pg_layout_clear_metrics(layout); OK(pg_layout_run(layout));
    pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics); assert(metrics.nodes_committed == 0);
    pg_node_invalidate(n[0]); r = sentinel;
    assert(pg_node_focus_bounds(n[1], 0, &r) == PG_INVALID); equal(r,sentinel);
    OK(pg_layout_run(layout));
    OK(pg_node_set_focus(n[0], PG_FOCUS_DOWNWARD | PG_FOCUS_UPWARD));
    OK(pg_node_set_size(n[5], 1000, 2000));
    assert(pg_node_focus_bounds(n[0], 0, &r) == PG_INVALID);
    OK(pg_layout_run(layout));
    OK(pg_node_focus_bounds(n[0], 0, &r)); equal(r,bodies(selected,5));
    assert(pg_node_disconnect(n[0], PG_DOWNWARD) == n[1]);
    OK(pg_layout_run(layout));
    pg_node *remaining[] = {n[0],n[2]};
    OK(pg_node_focus_bounds(n[0], 0, &r)); equal(r,bodies(remaining,2));
    OK(pg_caret_move_to(c, n[0]));
    pg_node_free_tree(n[1]);
    assert(pg_node_bounds_for_directions(NULL, 0, &r) == PG_INVALID);
    assert(pg_node_bounds_for_directions(n[0], 0, NULL) == PG_INVALID);
    assert(pg_caret_set_focus(NULL, 0) == PG_INVALID);
    pg_caret_clear_focus(NULL);
    OK(pg_node_set_focus(n[0], PG_FOCUS_DOWNWARD));
    pg_node *parent = pg_node_new(NULL); assert(parent);
    OK(pg_node_connect(parent, PG_UPWARD, n[0]));
    assert(pg_node_focus_bounds(n[0], 0, &r) == PG_INVALID);
    pg_caret_free(c); pg_layout_free(layout); pg_node_free_tree(parent);
    return 0;
}
