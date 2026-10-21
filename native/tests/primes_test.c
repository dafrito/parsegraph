#include "primes.h"
#include "parsegraph/layout.h"

#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>

#define OK(expr) assert((expr) == PG_OK)

static bool prime(int n) {
    if (n < 2) return false;
    for (int factor = 2; factor * factor <= n; ++factor)
        if (n % factor == 0) return false;
    return true;
}
static int prime_count(int n) {
    int result = 0;
    for (int i = 2; i <= n; ++i) result += prime(i);
    return result;
}
static void near(double a, double b) { assert(fabs(a-b) < 1e-7); }
static pg_status measure(pg_node *node, double size[2], void *context) {
    (void)node;
    size[0] = size[1] = pg_primes_cell_side(context);
    return PG_OK;
}
static pg_layout *new_layout(pg_primes *p) {
    const pg_layout_painter painter = {measure, NULL, p};
    pg_layout *layout = pg_layout_new(pg_primes_root(p), &painter);
    assert(layout);
    return layout;
}

/* Independent oracle: each integer has one base cell, and one cell for each
 * prime <= that integer. These squares tile columns; divisibility supplies
 * the text, not factor multiplicity. This does not duplicate the builder's
 * incremental known-prime table or its caret traversal. */
static void verify(pg_primes *p) {
    size_t index = 0, groups = 0, expected_groups = 1;
    pg_node *previous_base = NULL;
    double side = pg_primes_cell_side(p);
    for (int number = 1; number <= pg_primes_count(p); ++number) {
        const pg_primes_record *base = pg_primes_record_at(p, index++);
        assert(base && pg_node_value(base->node) == base);
        char id[48], text[16];
        snprintf(id, sizeof(id), "primes-%d", number);
        snprintf(text, sizeof(text), "%d", number);
        assert(!strcmp(base->id, id) && !strcmp(base->text, text));
        assert(pg_node_parent(base->node) == previous_base);
        assert(pg_node_parent_direction(base->node) == (number == 1 ? PG_DIRECTION_NONE : PG_BACKWARD));
        if (previous_base) assert(pg_node_child(previous_base, PG_FORWARD) == base->node);
        pg_node *previous_cell = base->node;
        int row = 0;
        for (int factor = 2; factor <= number; ++factor) {
            if (!prime(factor)) continue;
            const pg_primes_record *cell = pg_primes_record_at(p, index++);
            assert(cell && pg_node_value(cell->node) == cell);
            snprintf(id, sizeof(id), "primes-%d-factor-%d", number, factor);
            if (number % factor == 0) snprintf(text, sizeof(text), "%d", factor);
            else text[0] = 0;
            assert(!strcmp(cell->id, id) && !strcmp(cell->text, text));
            assert(pg_node_parent(cell->node) == previous_cell);
            assert(pg_node_child(previous_cell, PG_UPWARD) == cell->node);
            assert(pg_node_parent_direction(cell->node) == PG_DOWNWARD);
            assert(pg_node_is_creased(cell->node) == (factor < number && row % 250 == 0));
            pg_transform world, local, group;
            OK(pg_node_absolute_transform(cell->node, &world));
            near(world.x, (number-1)*side);
            near(world.y, -(++row)*side);
            near(world.scale, 1);
            OK(pg_node_group_transform(cell->node, &local));
            OK(pg_node_absolute_transform(pg_node_paint_group(cell->node), &group));
            near(local.x * group.scale + group.x, world.x);
            near(local.y * group.scale + group.y, world.y);
            near(local.scale * group.scale, world.scale);
            previous_cell = cell->node;
        }
        /* Each column creases every 250 existing primes. A newly discovered
         * prime belongs to the preceding group until the following column. */
        const size_t existing_primes = (size_t)row - (prime(number) ? 1 : 0);
        expected_groups += (existing_primes + 249) / 250;
        assert(!pg_node_child(previous_cell, PG_UPWARD));
        pg_transform base_world;
        OK(pg_node_absolute_transform(base->node, &base_world));
        near(base_world.x, (number-1)*side);
        near(base_world.y, 0);
        previous_base = base->node;
    }
    assert(index == pg_primes_node_count(p));
    for (size_t i = 0; i < index; ++i) {
        pg_node *node = pg_primes_record_at(p, i)->node;
        assert(pg_node_fit(node) == PG_FIT_LOOSE);
        groups += pg_node_is_paint_group(node);
    }
    assert(groups == expected_groups);
    assert(!pg_node_child(previous_base, PG_FORWARD));
    double extent_size[2];
    OK(pg_node_extent_size(pg_primes_root(p), extent_size));
    near(extent_size[0], pg_primes_count(p)*side);
    near(extent_size[1], (prime_count(pg_primes_count(p))+1)*side);
}

static void topology_and_geometry(void) {
    const int counts[] = {1, 2, 3, 10, 30, 100};
    for (size_t i = 0; i < sizeof(counts)/sizeof(*counts); ++i) {
        pg_primes *p = pg_primes_new(counts[i]); assert(p);
        assert(pg_primes_count(p) == 1);
        const pg_primes_record *root_record = pg_primes_record_at(p, 0);
        OK(pg_primes_append(p, counts[i]));
        assert(root_record == pg_primes_record_at(p, 0));
        pg_layout *layout = new_layout(p); OK(pg_layout_run(layout));
        verify(p);
        pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
        assert(metrics.nodes_committed == pg_primes_node_count(p));
        pg_layout_free(layout); pg_primes_free(p);
    }
}

static void growth_matches_cold(void) {
    const int count = 150;
    pg_primes *cold = pg_primes_new(count); assert(cold);
    OK(pg_primes_append(cold, count));
    pg_layout *cold_layout = new_layout(cold); OK(pg_layout_run(cold_layout));
    for (int batch = 1; batch <= 7; batch += 6) {
        pg_primes *p = pg_primes_new(count); assert(p);
        pg_layout *layout = new_layout(p); OK(pg_layout_run(layout));
        for (int previous = 1; previous < count;) {
            int target = previous + batch;
            if (target > count) target = count;
            size_t before = pg_primes_node_count(p);
            OK(pg_primes_append(p, target));
            pg_layout_clear_metrics(layout); OK(pg_layout_run(layout));
            pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
            /* Only the base-row ancestor path and newly added columns commit.
             * Older factor columns are retained, even when the root grows. */
            assert(metrics.nodes_committed == pg_primes_node_count(p)-before+(size_t)previous);
            assert(metrics.clean_subtrees_skipped == (uint64_t)previous-1);
            previous = target;
        }
        verify(p);
        assert(pg_primes_node_count(p) == pg_primes_node_count(cold));
        for (size_t i = 0; i < pg_primes_node_count(p); ++i) {
            const pg_primes_record *a = pg_primes_record_at(p, i), *b = pg_primes_record_at(cold, i);
            assert(!strcmp(a->id, b->id));
            pg_transform ta, tb;
            OK(pg_node_absolute_transform(a->node, &ta));
            OK(pg_node_absolute_transform(b->node, &tb));
            near(ta.x, tb.x); near(ta.y, tb.y); near(ta.scale, tb.scale);
            for (int d = PG_DOWNWARD; d <= PG_BACKWARD; ++d)
                assert(pg_extent_equals(pg_node_extent(a->node, (pg_direction)d),
                                        pg_node_extent(b->node, (pg_direction)d), 0));
        }
        pg_layout_clear_metrics(layout); OK(pg_layout_run(layout));
        pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
        assert(metrics.nodes_committed == 0);
        pg_layout_free(layout); pg_primes_free(p);
    }
    pg_layout_free(cold_layout); pg_primes_free(cold);
}

static void boundaries(void) {
    assert(!pg_primes_new(0)); assert(!pg_primes_new(PG_PRIMES_MAX_COUNT + 1));
    pg_primes_free(NULL);
    assert(pg_primes_append(NULL, 2) == PG_INVALID);
    pg_primes *p = pg_primes_new(1000); assert(p);
    near(pg_primes_cell_side(p), 60);
    assert(pg_primes_append(p, 1001) == PG_RANGE);
    assert(pg_primes_append(p, 0) == PG_RANGE);
    assert(pg_primes_count(p) == 1 && pg_primes_node_count(p) == 1);
    assert(!pg_primes_record_at(p, 1));
    OK(pg_primes_append(p, 30));
    assert(pg_primes_append(p, 29) == PG_RANGE);
    size_t nodes = pg_primes_node_count(p);
    OK(pg_primes_append(p, 30)); assert(nodes == pg_primes_node_count(p));
    pg_primes_free(p);

    p = pg_primes_new(PG_PRIMES_MAX_COUNT); assert(p);
    near(pg_primes_cell_side(p), 70);
    assert(pg_primes_append(p, PG_PRIMES_MAX_COUNT + 1) == PG_RANGE);
    assert(pg_primes_count(p) == 1 && pg_primes_node_count(p) == 1);
    pg_primes_free(p);
}

static void growth_crosses_crease_boundary(void) {
    /* 1597 is the 251st prime; column 1598 is the first to require a second
     * factor paint group. Keep CI bounded instead of building all 6.56 million
     * nodes at the maximum, while exercising growth beyond the old limit. */
    pg_primes *p = pg_primes_new(PG_PRIMES_MAX_COUNT); assert(p);
    OK(pg_primes_append(p, 1597));
    pg_layout *layout = new_layout(p); OK(pg_layout_run(layout));
    const size_t before = pg_primes_node_count(p);
    const pg_primes_record *previous_last = pg_primes_record_at(p, before - 1);
    assert(!strcmp(previous_last->id, "primes-1597-factor-1597"));
    assert(!pg_node_is_creased(previous_last->node));

    OK(pg_primes_append(p, 1598));
    pg_layout_clear_metrics(layout); OK(pg_layout_run(layout));
    pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
    assert(metrics.nodes_committed == pg_primes_node_count(p) - before + 1597);
    assert(metrics.clean_subtrees_skipped == 1596);
    const pg_primes_record *last = pg_primes_record_at(p, pg_primes_node_count(p) - 1);
    assert(!strcmp(last->id, "primes-1598-factor-1597"));
    assert(pg_node_is_creased(last->node));
    assert(pg_node_paint_group(last->node) == last->node);
    verify(p);
    pg_layout_free(layout); pg_primes_free(p);
}

int main(void) {
    boundaries(); topology_and_geometry(); growth_matches_cold(); growth_crosses_crease_boundary();
    puts("primes: topology, divisibility, creases, square geometry, incremental reuse and cold parity passed");
    return 0;
}
