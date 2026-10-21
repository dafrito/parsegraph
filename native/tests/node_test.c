#include "parsegraph/node.h"
#include "../src/node_internal.h"

#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

static void near(double a, double b) { assert(fabs(a - b) < 1e-9); }

static void ownership(void) {
    int value = 42;
    pg_node *root = pg_node_new(&value), *a = pg_node_new(NULL), *b = pg_node_new(NULL), *c = pg_node_new(NULL);
    assert(root && a && b && c);
    assert(pg_node_value(root) == &value);
    assert(pg_node_id(root) != pg_node_id(a));
    pg_node_set_id(root, 9001); assert(pg_node_id(root) == 9001);
    assert(pg_node_connect(root, PG_FORWARD, a) == PG_OK);
    assert(pg_node_connect(root, PG_FORWARD, b) == PG_OK);
    assert(pg_node_parent(a) == NULL && pg_node_parent(b) == root);
    assert(pg_node_at(b, PG_BACKWARD) == root);
    assert(pg_node_connect(a, PG_DOWNWARD, c) == PG_OK);
    assert(pg_node_connect(root, PG_UPWARD, c) == PG_OK);
    assert(pg_node_at(a, PG_DOWNWARD) == NULL);
    assert(pg_node_connect(c, PG_FORWARD, root) == PG_INVALID);
    assert(pg_node_parent(root) == NULL && pg_node_parent(c) == root);
    assert(pg_node_connect(b, PG_BACKWARD, a) == PG_INVALID);
    assert(pg_node_connect(root, PG_OUTWARD, a) == PG_INVALID);
    assert(pg_node_connect(root, (pg_direction)1000, a) == PG_INVALID);
    assert(pg_node_connect(root, PG_DOWNWARD, root) == PG_INVALID);
    pg_node_free(root);
    assert(pg_node_parent(b) == NULL && pg_node_parent(c) == NULL);
    assert(pg_node_paint_group(b) == b && pg_node_paint_group(c) == c);
    assert(value == 42);
    pg_node_free(a); pg_node_free(b); pg_node_free(c); pg_node_free(NULL);

    root = pg_node_new(NULL); a = pg_node_new(NULL); b = pg_node_new(NULL); c = pg_node_new(NULL);
    assert(pg_node_connect(root, PG_FORWARD, a) == PG_OK);
    assert(pg_node_connect(a, PG_FORWARD, b) == PG_OK);
    assert(pg_node_connect(root, PG_DOWNWARD, c) == PG_OK);
    pg_node_free_tree(a);
    assert(pg_node_at(root, PG_FORWARD) == NULL && pg_node_at(root, PG_DOWNWARD) == c);
    pg_node_free_tree(root);
}

static void configuration(void) {
    pg_node *root = pg_node_new(NULL), *a = pg_node_new(NULL);
    assert(pg_node_set_scale(root, 0) == PG_INVALID);
    assert(pg_node_set_scale(root, NAN) == PG_INVALID);
    assert(pg_node_set_scale(root, INFINITY) == PG_INVALID);
    assert(pg_node_set_size(root, -1, 10) == PG_INVALID);
    assert(pg_node_set_size(root, 10, 20) == PG_OK);
    assert(pg_node_set_fit(root, PG_FIT_NULL) == PG_INVALID);
    assert(pg_node_set_preferred_axis(root, PG_PREFERRED_PARENT) == PG_INVALID);
    assert(pg_node_set_alignment(root, PG_FORWARD, PG_ALIGN_CENTER) == PG_OK);
    assert(pg_node_set_overlap(root, PG_FORWARD, PG_OVERLAP_PREVENTED) == PG_OK);
    assert(pg_node_set_alignment(a, PG_BACKWARD, PG_ALIGN_NEGATIVE) == PG_OK);
    assert(pg_node_connect(root, PG_FORWARD, a) == PG_OK);
    assert(pg_node_at(a, PG_BACKWARD) == root); /* Empty local slot cannot mask parent. */
    assert(pg_node_alignment(root, PG_FORWARD) == PG_ALIGN_CENTER);
    assert(pg_node_alignment(a, PG_BACKWARD) == PG_ALIGN_CENTER);
    assert(pg_node_set_alignment(a, PG_DIRECTION_NONE, PG_ALIGN_NEGATIVE) == PG_OK);
    assert(pg_node_alignment(root, PG_FORWARD) == PG_ALIGN_NEGATIVE);
    assert(pg_node_overlap(a, PG_DIRECTION_NONE) == PG_OVERLAP_PREVENTED);
    assert(pg_node_set_overlap(a, PG_DIRECTION_NONE, PG_OVERLAP_ALLOWED) == PG_OK);
    assert(pg_node_overlap(root, PG_FORWARD) == PG_OVERLAP_ALLOWED);
    assert(pg_node_set_preferred_axis(a, PG_PREFERRED_VERTICAL) == PG_OK);
    assert(pg_node_preferred_axis(a) == PG_PREFERRED_PERPENDICULAR);
    assert(pg_node_disconnect(a, PG_BACKWARD) == a);
    assert(pg_node_preferred_axis(a) == PG_PREFERRED_VERTICAL);
    assert(pg_node_set_alignment(a, PG_DIRECTION_NONE, PG_ALIGN_CENTER) == PG_INVALID);
    assert(pg_node_disconnect(root, PG_UPWARD) == NULL);
    assert(pg_node_disconnect(root, PG_DIRECTION_NONE) == root);
    pg_node_free(root); pg_node_free(a);
}

static void inward_reordering(void) {
    pg_node *r = pg_node_new(NULL), *inner = pg_node_new(NULL);
    pg_node *forward = pg_node_new(NULL), *downward = pg_node_new(NULL);
    assert(pg_node_set_preferred_axis(inner, PG_PREFERRED_VERTICAL) == PG_OK);
    assert(pg_node_connect(inner, PG_FORWARD, forward) == PG_OK);
    assert(pg_node_connect(inner, PG_DOWNWARD, downward) == PG_OK);
    assert(pg_node_sibling_next(inner) == downward);
    assert(pg_node_connect(r, PG_INWARD, inner) == PG_OK);
    assert(pg_node_sibling_next(r) == forward);
    assert(pg_node_sibling_next(forward) == downward);
    assert(pg_node_sibling_next(downward) == inner);
    assert(pg_node_sibling_next(inner) == r);
    assert(pg_node_set_preferred_axis(inner, PG_PREFERRED_PARENT) == PG_OK);
    assert(pg_node_disconnect(r, PG_INWARD) == inner);
    assert(pg_node_sibling_next(inner) == forward);
    assert(pg_node_sibling_next(forward) == downward);
    assert(pg_node_sibling_next(downward) == inner);
    pg_node_free_tree(inner); pg_node_free(r);
}

/* Independent bounded-tree postorder oracle. Random topology tests keep this
 * model at 64 nodes; production traversal and the deep test are iterative. */
static const pg_direction h_order[] = {PG_INWARD,PG_BACKWARD,PG_FORWARD,PG_DOWNWARD,PG_UPWARD,PG_OUTWARD};
static const pg_direction v_order[] = {PG_INWARD,PG_DOWNWARD,PG_UPWARD,PG_BACKWARD,PG_FORWARD,PG_OUTWARD};
static const pg_direction *model_order(pg_node *n) {
    pg_preferred_axis p = pg_node_preferred_axis(n);
    if (!pg_node_parent(n)) return p == PG_PREFERRED_HORIZONTAL || p == PG_PREFERRED_PERPENDICULAR ? h_order : v_order;
    bool parent_horizontal = pg_direction_axis(pg_node_parent_direction(n)) == PG_HORIZONTAL;
    bool parent_vertical = pg_direction_axis(pg_node_parent_direction(n)) == PG_VERTICAL;
    if (p == PG_PREFERRED_HORIZONTAL) p = parent_horizontal ? PG_PREFERRED_PARENT : PG_PREFERRED_PERPENDICULAR;
    if (p == PG_PREFERRED_VERTICAL) p = parent_vertical ? PG_PREFERRED_PARENT : PG_PREFERRED_PERPENDICULAR;
    bool horizontal = p == PG_PREFERRED_PARENT ? parent_horizontal : !parent_horizontal;
    return horizontal ? h_order : v_order;
}
static void model_group(pg_node *n, pg_node **expected, size_t *count) {
    const pg_direction *order = model_order(n);
    for (unsigned i = 0; i < 6; ++i) {
        pg_node *child = pg_node_child(n, order[i]);
        if (child && !pg_node_is_creased(child)) model_group(child, expected, count);
    }
    assert(*count < 64); expected[(*count)++] = n;
}
static void verify_nodes(pg_node **nodes, size_t count) {
    for (size_t i = 0; i < count; ++i) {
        pg_node *n = nodes[i], *expected_group = n;
        size_t parents = 0;
        for (pg_node *p = n; pg_node_parent(p); p = pg_node_parent(p)) {
            assert(++parents <= count);
            assert(pg_node_child(pg_node_parent(p), pg_direction_reverse(pg_node_parent_direction(p))) == p);
        }
        while (pg_node_parent(expected_group) && !pg_node_is_creased(expected_group)) expected_group = pg_node_parent(expected_group);
        assert(pg_node_paint_group(n) == expected_group);
        assert(pg_node_sibling_prev(pg_node_sibling_next(n)) == n);
        assert(pg_node_sibling_next(pg_node_sibling_prev(n)) == n);
        if (!pg_node_is_paint_group(n)) continue;
        pg_node *expected[64]; size_t length = 0;
        model_group(n, expected, &length);
        pg_node *actual = pg_node_sibling_next(n);
        for (size_t j = 0; j < length; ++j) {
            assert(actual == expected[j]);
            actual = pg_node_sibling_next(actual);
        }
        assert(actual == pg_node_sibling_next(n));
    }
}
static uint32_t rng_state = 0x1eaf1234;
static uint32_t random_u32(void) { rng_state = rng_state * 1664525u + 1013904223u; return rng_state; }
static void dynamic_topology(void) {
    pg_node *nodes[64];
    for (size_t i = 0; i < 64; ++i) { nodes[i] = pg_node_new(NULL); assert(nodes[i]); }
    const pg_direction attach_dirs[] = {PG_INWARD,PG_DOWNWARD,PG_UPWARD,PG_FORWARD,PG_BACKWARD};
    for (size_t iteration = 0; iteration < 12000; ++iteration) {
        pg_node *a = nodes[(random_u32() >> 16) % 64];
        pg_node *b = nodes[(random_u32() >> 16) % 64];
        unsigned op = (random_u32() >> 16) % 6;
        pg_direction d = attach_dirs[(random_u32() >> 16) % 5];
        switch (op) {
            case 0: case 1: (void)pg_node_connect(a, d, b); break;
            case 2: (void)pg_node_disconnect(a, (random_u32() & 1) ? d : PG_DIRECTION_NONE); break;
            case 3: assert(pg_node_crease(a) == PG_OK); break;
            case 4: assert(pg_node_uncrease(a) == PG_OK); break;
            case 5: (void)pg_node_set_preferred_axis(a, (pg_preferred_axis)(1 + ((random_u32() >> 16) % 4))); break;
        }
        verify_nodes(nodes, 64);
    }
    for (size_t i = 0; i < 64; ++i) pg_node_free(nodes[i]);
}

static void transforms(void) {
    pg_node *r = pg_node_new(NULL), *a = pg_node_new(NULL), *b = pg_node_new(NULL), *c = pg_node_new(NULL);
    assert(pg_node_set_scale(r, 99) == PG_OK); /* Roots define identity. */
    assert(pg_node_set_scale(a, 2) == PG_OK);
    assert(pg_node_set_scale(b, .5) == PG_OK);
    assert(pg_node_connect(r, PG_FORWARD, a) == PG_OK);
    assert(pg_node_connect(a, PG_DOWNWARD, b) == PG_OK);
    assert(pg_node_connect(b, PG_FORWARD, c) == PG_OK);
    r->edges[PG_FORWARD].x = 10; r->edges[PG_FORWARD].y = 20;
    a->edges[PG_DOWNWARD].x = 3; a->edges[PG_DOWNWARD].y = 4;
    b->edges[PG_FORWARD].x = -2; b->edges[PG_FORWARD].y = 7;
    pg_node_layout_changed(r);
    pg_transform t;
    assert(pg_node_absolute_transform(b, &t) == PG_OK); near(t.x,16); near(t.y,28); near(t.scale,1);
    assert(pg_node_crease(a) == PG_OK);
    assert(pg_node_group_transform(b, &t) == PG_OK); near(t.x,3); near(t.y,4); near(t.scale,.5);
    uint64_t b_local_version = b->group_seen;
    assert(pg_node_absolute_transform(b, &t) == PG_OK); near(t.x,16); near(t.y,28); near(t.scale,1);
    r->edges[PG_FORWARD].x = 100; r->edges[PG_FORWARD].y = 200;
    pg_node_layout_changed(r);
    assert(pg_node_absolute_transform(b, &t) == PG_OK); near(t.x,106); near(t.y,208); near(t.scale,1);
    assert(b->group_seen == b_local_version); /* Group movement preserves its interior. */
    assert(pg_node_set_scale(a, 3) == PG_OK);
    assert(pg_node_absolute_transform(b, &t) == PG_OK); near(t.x,109); near(t.y,212); near(t.scale,1.5);
    assert(b->group_seen == b_local_version); /* Whole-group scale is likewise external. */
    assert(pg_node_set_scale(a, 2) == PG_OK);
    assert(pg_node_crease(b) == PG_OK);
    assert(pg_node_absolute_transform(c, &t) == PG_OK); near(t.x,104); near(t.y,215); near(t.scale,1);
    assert(pg_node_group_transform(c, &t) == PG_OK); near(t.x,-2); near(t.y,7); near(t.scale,1);
    assert(pg_node_uncrease(a) == PG_OK);
    assert(pg_node_absolute_transform(c, &t) == PG_OK); near(t.x,104); near(t.y,215); near(t.scale,1);
    assert(pg_node_disconnect(a, PG_DIRECTION_NONE) == a);
    assert(pg_node_absolute_transform(c, &t) == PG_OK); near(t.x,2); near(t.y,7.5); near(t.scale,.5);
    pg_node_free_tree(a); pg_node_free(r);
}

static void deep_tree(void) {
    pg_node *root = pg_node_new(NULL), *last = root;
    assert(root);
    for (unsigned i = 0; i < 20000; ++i) {
        pg_node *child = pg_node_new(NULL); assert(child);
        assert(pg_node_connect(last, PG_FORWARD, child) == PG_OK);
        last->edges[PG_FORWARD].x = 2; last->edges[PG_FORWARD].y = 0;
        last = child;
    }
    pg_node_layout_changed(root);
    pg_transform t;
    assert(pg_node_absolute_transform(last, &t) == PG_OK); near(t.x,40000); near(t.y,0); near(t.scale,1);
    size_t count = 0;
    for (pg_node *n = root; n; n = pg_node_next_preorder(n, root)) ++count;
    assert(count == 20001);
    pg_node_free_tree(root);
}

static void transform_range(void) {
    const double factors[] = {1e200, 1e-200};
    for (unsigned creased = 0; creased < 2; ++creased) {
        for (unsigned i = 0; i < 2; ++i) {
            pg_node *r = pg_node_new(NULL), *a = pg_node_new(NULL), *b = pg_node_new(NULL);
            assert(r && a && b);
            assert(pg_node_connect(r, PG_INWARD, a) == PG_OK);
            assert(pg_node_connect(a, PG_INWARD, b) == PG_OK);
            r->edges[PG_INWARD].x = r->edges[PG_INWARD].y = 0;
            a->edges[PG_INWARD].x = a->edges[PG_INWARD].y = 0;
            if (creased) { assert(pg_node_crease(a) == PG_OK); assert(pg_node_crease(b) == PG_OK); }
            assert(pg_node_set_scale(a, factors[i]) == PG_OK);
            assert(pg_node_set_scale(b, factors[i]) == PG_OK);
            pg_transform out = {123, 456, 789};
            if (!creased) {
                assert(pg_node_group_transform(b, &out) == PG_RANGE);
                near(out.x,123); near(out.y,456); near(out.scale,789);
            }
            assert(pg_node_absolute_transform(b, &out) == PG_RANGE);
            near(out.x,123); near(out.y,456); near(out.scale,789);
            assert(pg_node_set_scale(a, 2) == PG_OK);
            assert(pg_node_set_scale(b, .5) == PG_OK);
            assert(pg_node_absolute_transform(b, &out) == PG_OK);
            near(out.x,0); near(out.y,0); near(out.scale,1);
            /* Finite scales can still overflow the translated position. */
            assert(pg_node_set_scale(a, 4) == PG_OK);
            a->edges[PG_INWARD].x = 1e308;
            pg_node_layout_changed(a);
            out = (pg_transform){123,456,789};
            assert(pg_node_absolute_transform(b, &out) == PG_RANGE);
            near(out.x,123); near(out.y,456); near(out.scale,789);
            a->edges[PG_INWARD].x = 3;
            pg_node_layout_changed(a);
            assert(pg_node_absolute_transform(b, &out) == PG_OK);
            near(out.x,12); near(out.y,0); near(out.scale,2);
            pg_node_free_tree(r);
        }
    }
    pg_node *root = pg_node_new(NULL);
    assert(root && pg_node_set_size(root, 4, 4) == PG_OK);
    assert(pg_extent_append(&root->extents[PG_DOWNWARD - PG_DOWNWARD], 4, 2) == PG_OK);
    assert(pg_extent_append(&root->extents[PG_FORWARD - PG_DOWNWARD], 4, 2) == PG_OK);
    assert(pg_node_contains_body(root, 0, 0, 1));
    assert(!pg_node_contains_body(root, 0, 0, 1e308));
    assert(!pg_node_contains_extents(root, 0, 0, 1e308));
    assert(!pg_node_contains_body(root, INFINITY, 0, 1));
    pg_node_free(root);
}

int main(void) {
    ownership(); configuration(); inward_reordering(); dynamic_topology(); transforms(); transform_range(); deep_tree();
    puts("node: ownership, 12,000 dynamic topology operations, group transforms, and 20,001-node depth passed");
    return 0;
}
