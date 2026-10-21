#include "parsegraph/layout.h"
#include "../src/node_internal.h" /* Cache generations are implementation invariants. */

#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>

#define OK(expression) assert((expression) == PG_OK)
static void near(double a, double b) { assert(fabs(a-b) < 1e-6); }

typedef struct body { double width, height; } body;
typedef struct painter_state { size_t measurements; double gap; bool fail; } painter_state;
static pg_status measure(pg_node *node, double size[2], void *context) {
    painter_state *state = context;
    ++state->measurements;
    if (state->fail) return PG_INVALID;
    body *b = pg_node_value(node);
    size[0] = b ? b->width : 24;
    size[1] = b ? b->height : 80;
    return PG_OK;
}
static double separation(pg_node *node, pg_axis axis, pg_direction direction,
                          bool prefer_vertical, void *context) {
    (void)node; (void)axis; (void)direction; (void)prefer_vertical;
    return ((painter_state *)context)->gap;
}
static pg_layout *new_layout(pg_node *node, painter_state *state) {
    pg_layout_painter painter = {measure, separation, state};
    pg_layout *layout = pg_layout_new(node, &painter);
    assert(layout);
    return layout;
}
static pg_node *attach(pg_node *node, pg_direction direction) {
    pg_node *c = pg_node_new(NULL);
    assert(c);
    OK(pg_node_connect(node, direction, c));
    return c;
}
static void position(pg_node *node, pg_direction d, double x, double y) {
    double pos[2]; OK(pg_node_child_position(node, d, pos));
    near(pos[0], x); near(pos[1], y);
}

static void cardinal_geometry(void) {
    const pg_direction directions[] = {PG_DOWNWARD, PG_UPWARD, PG_FORWARD, PG_BACKWARD};
    for (int fit = PG_FIT_EXACT; fit <= PG_FIT_LOOSE; ++fit) {
        for (size_t i = 0; i < 4; ++i) {
            painter_state state = {0, 10, false};
            pg_node *root = pg_node_new(NULL), *c = attach(root, directions[i]);
            assert(root); OK(pg_node_set_fit(root, (pg_fit)fit));
            OK(pg_node_set_scale(c, .5));
            pg_layout *layout = new_layout(root, &state);
            OK(pg_layout_run(layout));
            bool vert = i < 2;
            double displacement = vert ? 65 : 23;
            double sign = i%2 ? -1 : 1;
            position(root, directions[i], vert ? 0 : sign*displacement,
                       vert ? sign*displacement : 0);
            near(pg_node_line_length(root, directions[i]), 17 + (vert ? 28 : 0));
            for (size_t j = 0; j < 4; ++j) {
                const pg_extent *e = pg_node_extent(root, directions[j]);
                double center_size;
                assert(pg_extent_offset(e) > 0);
                OK(pg_extent_size_at(e, pg_extent_offset(e), &center_size));
                assert(center_size >= (j < 2 ? 40 : 12));
            }
            pg_transform transform;
            OK(pg_node_absolute_transform(c, &transform));
            near(transform.scale, .5);
            assert(state.measurements == 2);
            OK(pg_layout_run(layout));
            assert(state.measurements == 2);
            pg_layout_free(layout); pg_node_free_tree(root);
        }
    }
}

static void branches_and_alignment(void) {
    painter_state state = {0, 0, false};
    pg_node *root = pg_node_new(NULL), *down = attach(root, PG_DOWNWARD);
    pg_node *forward = attach(down, PG_FORWARD);
    OK(pg_node_set_scale(down, .5)); OK(pg_node_set_scale(forward, .25));
    OK(pg_node_set_alignment(root, PG_DOWNWARD, PG_ALIGN_POSITIVE));
    pg_layout *layout = new_layout(root, &state);
    OK(pg_layout_run(layout));
    double length, alignment;
    OK(pg_layout_consecutive_length(down, PG_FORWARD, &length)); near(length, 15);
    OK(pg_layout_alignment(root, PG_DOWNWARD, &alignment)); near(alignment, -7.5);
    position(root, PG_DOWNWARD, -7.5, 60);
    OK(pg_node_set_alignment(root, PG_DOWNWARD, PG_ALIGN_CENTER));
    OK(pg_layout_run(layout)); position(root, PG_DOWNWARD, -3.75, 60);
    OK(pg_node_set_alignment(root, PG_DOWNWARD, PG_ALIGN_NEGATIVE));
    OK(pg_layout_run(layout)); position(root, PG_DOWNWARD, 0, 60);
    pg_layout_free(layout); pg_node_free_tree(root);

    root = pg_node_new(NULL);
    attach(root, PG_DOWNWARD); attach(root, PG_UPWARD);
    attach(root, PG_FORWARD); attach(root, PG_BACKWARD);
    state.gap = 10;
    layout = new_layout(root, &state);
    OK(pg_layout_run(layout));
    position(root, PG_DOWNWARD, 0, 90); position(root, PG_UPWARD, 0, -90);
    position(root, PG_FORWARD, 34, 0); position(root, PG_BACKWARD, -34, 0);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void inward_layout(void) {
    painter_state state = {0, 10, false};
    body outer = {100, 200};
    pg_node *root = pg_node_new(&outer), *inner = attach(root, PG_INWARD);
    OK(pg_node_set_scale(inner, .5));
    pg_layout *layout = new_layout(root, &state);
    OK(pg_layout_run(layout));
    position(root, PG_INWARD, 39, 0);
    OK(pg_node_set_alignment(root, PG_INWARD, PG_ALIGN_INWARD_VERTICAL));
    OK(pg_layout_run(layout));
    position(root, PG_INWARD, 0, 75);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void incremental_and_groups(void) {
    painter_state state = {0, 0, false};
    pg_node *root = pg_node_new(NULL), *group = attach(root, PG_FORWARD);
    OK(pg_node_crease(group));
    pg_node *inside = attach(group, PG_DOWNWARD);
    pg_node *other = attach(root, PG_BACKWARD);
    attach(other, PG_DOWNWARD);
    pg_layout *layout = new_layout(root, &state);
    OK(pg_layout_run(layout)); assert(state.measurements == 5);
    pg_transform local_before, absolute_before, local_after, absolute_after;
    OK(pg_node_group_transform(inside, &local_before));
    OK(pg_node_absolute_transform(inside, &absolute_before));
    body bigger = {100, 80};
    pg_node_set_value(root, &bigger);
    pg_layout_clear_metrics(layout);
    OK(pg_layout_run(layout)); assert(state.measurements == 6);
    pg_layout_metrics metrics;
    pg_layout_get_metrics(layout, &metrics);
    assert(metrics.nodes_committed == 1);
    assert(metrics.clean_subtrees_skipped == 2);
    assert(metrics.work_units == 7);
    OK(pg_node_group_transform(inside, &local_after));
    OK(pg_node_absolute_transform(inside, &absolute_after));
    near(local_before.x, local_after.x); near(local_before.y, local_after.y);
    assert(absolute_before.x != absolute_after.x);
    near(absolute_before.y, absolute_after.y);
    pg_node_invalidate(inside);
    pg_layout_clear_metrics(layout);
    OK(pg_layout_run(layout));
    pg_layout_get_metrics(layout, &metrics);
    assert(metrics.nodes_committed == 3);
    assert(metrics.clean_subtrees_skipped == 1);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void resumable_and_mutations(void) {
    painter_state state = {0, 0, false};
    pg_node *root = pg_node_new(NULL), *old = attach(root, PG_FORWARD);
    attach(old, PG_DOWNWARD);
    pg_layout *layout = new_layout(root, &state);
    bool done = true;
    OK(pg_layout_step(layout, 0, &done)); assert(!done);
    OK(pg_layout_step(layout, 5, &done)); assert(!done);
    assert(pg_node_disconnect(root, PG_FORWARD) == old);
    pg_node_free_tree(old); /* The suspended stack must not dereference old. */
    attach(root, PG_DOWNWARD);
    size_t calls = 0;
    while (!done) { OK(pg_layout_step(layout, 1, &done)); assert(++calls <= 20); }
    position(root, PG_DOWNWARD, 0, 80);
    pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
    assert(metrics.restarts == 1);
    state.fail = true;
    pg_node_invalidate(root);
    assert(pg_layout_run(layout) == PG_INVALID);
    assert(pg_node_phase(root) == PG_LAYOUT_NEEDS_COMMIT);
    state.fail = false;
    OK(pg_layout_run(layout));
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void naive_initialization(void) {
    painter_state state = {0, 0, false};
    pg_node *root = pg_node_new(NULL), *c = attach(root, PG_FORWARD);
    OK(pg_node_set_fit(root, PG_FIT_NAIVE));
    pg_layout *layout = new_layout(root, &state);
    OK(pg_layout_run(layout)); position(root, PG_FORWARD, 24, 0);
    body larger = {100, 100}; pg_node_set_value(root, &larger);
    OK(pg_layout_run(layout)); position(root, PG_FORWARD, 24, 0);
    OK(pg_node_set_fit(c, PG_FIT_NAIVE));
    attach(c, PG_DOWNWARD);
    OK(pg_layout_run(layout)); position(c, PG_DOWNWARD, 0, 80);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void deep_graph(void) {
    painter_state state = {0, 0, false};
    pg_node *root = pg_node_new(NULL), *tail = root;
    const size_t count = 6000;
    for (size_t i = 1; i < count; ++i) tail = attach(tail, PG_FORWARD);
    pg_layout *layout = new_layout(root, &state);
    OK(pg_layout_run(layout)); assert(state.measurements == count);
    pg_transform transform; OK(pg_node_absolute_transform(tail, &transform));
    near(transform.x, (count-1)*24); near(transform.y, 0);
    pg_node_invalidate(tail);
    bool done = false;
    while (!done) OK(pg_layout_step(layout, 31, &done));
    assert(state.measurements == 2*count);
    pg_layout_free(layout); pg_node_free_tree(root);
}

static void body_size_without_callbacks(void) {
    pg_node *root = pg_node_new(NULL), *c = attach(root, PG_FORWARD);
    OK(pg_node_set_size(root, 20, 30)); OK(pg_node_set_size(c, 40, 50));
    pg_layout *layout = pg_layout_new(root, NULL);
    assert(layout); OK(pg_layout_run(layout));
    position(root, PG_FORWARD, 30, 0);
    pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
    assert(metrics.nodes_measured == 0 && metrics.nodes_committed == 2);
    pg_node *other = pg_node_new(NULL);
    OK(pg_node_set_size(other, 5, 6)); OK(pg_layout_reset(layout, other));
    assert(pg_layout_root(layout) == other); OK(pg_layout_run(layout));
    pg_layout_free(layout); pg_node_free_tree(root); pg_node_free(other);
}

/* Independent geometry oracle: flatten the body rectangles, then check their
 * coverage by the root profiles. Loose fitting must produce exactly their
 * enclosing box; exact fitting must cover every sampled side. This does not
 * repeat the align/separate/combine formulas or compare against TypeScript. */
static void body_coverage_oracle(void) {
    static const unsigned parents[] = {0, 0, 0, 0, 1, 1, 2, 3, 3, 4, 5};
    static const pg_direction dirs[] = {PG_FORWARD, PG_BACKWARD, PG_DOWNWARD,
        PG_UPWARD, PG_DOWNWARD, PG_FORWARD, PG_UPWARD, PG_FORWARD,
        PG_DOWNWARD, PG_BACKWARD, PG_DOWNWARD};
    for (int fit = PG_FIT_EXACT; fit <= PG_FIT_LOOSE; ++fit) {
        body bodies[12]; pg_node *nodes[12];
        for (size_t i = 0; i < 12; ++i) {
            bodies[i] = (body){24+2*i, 32+4*i};
            nodes[i] = pg_node_new(&bodies[i]); assert(nodes[i]);
            OK(pg_node_set_fit(nodes[i], (pg_fit)fit));
            if (i) OK(pg_node_connect(nodes[parents[i-1]], dirs[i-1], nodes[i]));
        }
        OK(pg_node_set_scale(nodes[1], .5)); OK(pg_node_set_scale(nodes[2], .75));
        OK(pg_node_set_scale(nodes[3], 1.25)); OK(pg_node_set_scale(nodes[5], .75));
        OK(pg_node_crease(nodes[1])); OK(pg_node_crease(nodes[9]));
        painter_state state = {0, 8, false};
        pg_layout *layout = new_layout(nodes[0], &state); OK(pg_layout_run(layout));
        double min_x = INFINITY, min_y = INFINITY, max_x = -INFINITY, max_y = -INFINITY;
        for (size_t i = 0; i < 12; ++i) {
            pg_transform t; OK(pg_node_absolute_transform(nodes[i], &t));
            double left = t.x-bodies[i].width*t.scale/2;
            double right = t.x+bodies[i].width*t.scale/2;
            double top = t.y-bodies[i].height*t.scale/2;
            double bottom = t.y+bodies[i].height*t.scale/2;
            min_x = fmin(min_x, left); max_x = fmax(max_x, right);
            min_y = fmin(min_y, top); max_y = fmax(max_y, bottom);
            for (int side = PG_DOWNWARD; side <= PG_BACKWARD; ++side) {
                const pg_extent *e = pg_node_extent(nodes[0], (pg_direction)side);
                bool vertical_side = side == PG_DOWNWARD || side == PG_UPWARD;
                double start = vertical_side ? left : top, end = vertical_side ? right : bottom;
                double needed = side == PG_DOWNWARD ? bottom : side == PG_UPWARD ? -top :
                    side == PG_FORWARD ? right : -left;
                for (int sample = 0; sample < 3; ++sample) {
                    double position = sample == 0 ? start+1e-5 : sample == 1 ? (start+end)/2 : end-1e-5;
                    double actual; OK(pg_extent_size_at(e, position+pg_extent_offset(e), &actual));
                    assert(isfinite(actual) && actual+1e-4 >= needed);
                }
            }
        }
        if (fit == PG_FIT_LOOSE) {
            near(pg_extent_offset(pg_node_extent(nodes[0], PG_DOWNWARD)), -min_x);
            near(pg_extent_offset(pg_node_extent(nodes[0], PG_FORWARD)), -min_y);
            double expected[] = {max_y, -min_y, max_x, -min_x};
            for (int d = PG_DOWNWARD; d <= PG_BACKWARD; ++d) {
                pg_bound b; const pg_extent *e = pg_node_extent(nodes[0], (pg_direction)d);
                assert(pg_extent_count(e) == 1); OK(pg_extent_get(e, 0, &b));
                near(b.size, expected[d-PG_DOWNWARD]);
                near(b.length, d <= PG_UPWARD ? max_x-min_x : max_y-min_y);
            }
        }
        pg_layout_free(layout); pg_node_free_tree(nodes[0]);
    }
}

typedef struct opposing_fixture { pg_node *right, *left; } opposing_fixture;
static pg_status opposing_measure(pg_node *node, double size[2], void *context) {
    (void)context; const body *b = pg_node_value(node);
    size[0] = b->width; size[1] = b->height; return PG_OK;
}
static double opposing_spacing(pg_node *node, pg_axis axis, pg_direction direction,
                                bool prefer_vertical, void *context) {
    (void)axis; (void)prefer_vertical; opposing_fixture *f = context;
    return direction != PG_DOWNWARD ? 0 : node == f->right ? 90 : node == f->left ? 180 : 0;
}
static void opposing_scaled_subtrees(void) {
    body dimensions[] = {{10,10}, {10,10}, {20,20}, {10,10}, {20,20}, {200,10}, {400,20}};
    pg_node *nodes[7];
    for (size_t i = 0; i < 7; ++i) {
        nodes[i] = pg_node_new(&dimensions[i]); assert(nodes[i]);
        OK(pg_node_set_fit(nodes[i], PG_FIT_EXACT));
    }
    OK(pg_node_connect(nodes[0], PG_FORWARD, nodes[1]));
    OK(pg_node_connect(nodes[0], PG_BACKWARD, nodes[2]));
    OK(pg_node_connect(nodes[1], PG_DOWNWARD, nodes[3]));
    OK(pg_node_connect(nodes[2], PG_DOWNWARD, nodes[4]));
    OK(pg_node_connect(nodes[3], PG_BACKWARD, nodes[5]));
    OK(pg_node_connect(nodes[4], PG_FORWARD, nodes[6]));
    OK(pg_node_set_scale(nodes[2], .5));
    OK(pg_node_set_alignment(nodes[0], PG_FORWARD, PG_ALIGN_CENTER));
    OK(pg_node_set_alignment(nodes[0], PG_BACKWARD, PG_ALIGN_CENTER));
    opposing_fixture fixture = {nodes[1], nodes[2]};
    pg_layout_painter painter = {opposing_measure, opposing_spacing, &fixture};
    pg_layout *layout = pg_layout_new(nodes[0], &painter); assert(layout);
    OK(pg_layout_run(layout));
    pg_transform right, left;
    OK(pg_node_absolute_transform(nodes[5], &right));
    OK(pg_node_absolute_transform(nodes[6], &left));
    near(right.y, 50); near(left.y, 50);
    assert(right.x-100 >= left.x+100);
    position(nodes[0], PG_FORWARD, 205, -50);
    position(nodes[0], PG_BACKWARD, -205, -50);
    pg_layout_free(layout); pg_node_free_tree(nodes[0]);
}

static pg_status scale_sensitive_measure(pg_node *node, double size[2], void *context) {
    pg_status result = measure(node, size, context);
    size[0] *= pg_node_scale(node);
    return result;
}
static void group_scale_preserves_local_cache(void) {
    painter_state state = {0, 0, false};
    pg_node *root = pg_node_new(NULL), *bridge = attach(root, PG_FORWARD);
    pg_node *group = attach(bridge, PG_FORWARD), *tail = group;
    OK(pg_node_crease(group));
    for (unsigned i = 0; i < 128; ++i) tail = attach(tail, PG_FORWARD);
    pg_layout *layout = new_layout(root, &state); OK(pg_layout_run(layout));
    pg_transform local_before, absolute_before, local_after, absolute_after;
    OK(pg_node_group_transform(tail, &local_before));
    OK(pg_node_absolute_transform(tail, &absolute_before));
    uint64_t generation = group->group_generation, seen = tail->group_seen;
    OK(pg_node_set_scale(group, .5));
    pg_layout_clear_metrics(layout); OK(pg_layout_run(layout));
    pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
    assert(metrics.nodes_committed == 3);
    assert(group->group_generation == generation && tail->group_seen == seen);
    OK(pg_node_group_transform(tail, &local_after));
    OK(pg_node_absolute_transform(tail, &absolute_after));
    near(local_before.x, local_after.x); near(local_before.scale, local_after.scale);
    assert(absolute_before.x != absolute_after.x);
    near(absolute_after.scale, .5);
    pg_layout_free(layout);

    /* A host is allowed to measure content differently at a new scale. Such
     * a change really moves the interior, so its local cache must invalidate. */
    pg_layout_painter painter = {scale_sensitive_measure, separation, &state};
    layout = pg_layout_new(root, &painter); assert(layout);
    OK(pg_node_set_scale(group, .75)); OK(pg_layout_run(layout));
    assert(group->group_generation != generation);
    OK(pg_node_group_transform(tail, &local_after));
    assert(local_before.x != local_after.x);
    pg_layout_free(layout); pg_node_free_tree(root);
}

int main(void) {
    cardinal_geometry(); branches_and_alignment(); inward_layout();
    incremental_and_groups(); resumable_and_mutations(); naive_initialization(); deep_graph();
    body_size_without_callbacks();
    body_coverage_oracle();
    opposing_scaled_subtrees();
    group_scale_preserves_local_cache();
    puts("layout: geometry, alignments, inward, groups, incremental/resume, naive, and deep traversal passed");
    return 0;
}
