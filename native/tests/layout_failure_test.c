#undef malloc
#undef calloc
#undef realloc
#undef free
#include "parsegraph/layout.h"
#include <stdio.h>
#include <stdlib.h>

#define CHECK(expr) do { if (!(expr)) { \
    fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #expr); exit(1); \
} } while (0)
static long remaining = -1;
static size_t live;
static bool fail_now(void) {
    if (remaining == 0) return true;
    if (remaining > 0) --remaining;
    return false;
}
void *pg_test_malloc(size_t size) {
    if (fail_now()) return NULL;
    void *p = malloc(size); if (p) ++live; return p;
}
void *pg_test_calloc(size_t count, size_t size) {
    if (fail_now()) return NULL;
    void *p = calloc(count, size); if (p) ++live; return p;
}
void *pg_test_realloc(void *p, size_t size) {
    if (fail_now()) return NULL;
    bool was_null = p == NULL;
    void *result = realloc(p, size);
    if (result && was_null) ++live;
    return result;
}
void pg_test_free(void *p) {
    if (p) { CHECK(live); --live; }
    free(p);
}

static size_t fail_layout_allocations(pg_fit fit, size_t count) {
    size_t failures = 0;
    for (long limit = 0; limit < 8192; ++limit) {
        remaining = -1;
        pg_node *root = pg_node_new(NULL), *tail = root;
        CHECK(root);
        CHECK(pg_node_set_size(root, 24, 80) == PG_OK);
        CHECK(pg_node_set_fit(root, fit) == PG_OK);
        for (size_t i = 1; i < count; ++i) {
            pg_node *c = pg_node_new(NULL); CHECK(c);
            CHECK(pg_node_set_size(c, 24, 80) == PG_OK);
            CHECK(pg_node_set_fit(c, fit) == PG_OK);
            CHECK(pg_node_connect(tail, i%2 ? PG_FORWARD : PG_DOWNWARD, c) == PG_OK);
            tail = c;
        }
        pg_layout *layout = pg_layout_new(root, NULL); CHECK(layout);
        remaining = limit;
        pg_status status = pg_layout_run(layout);
        bool complete = status == PG_OK;
        if (!complete) {
            CHECK(status == PG_NOMEM);
            CHECK(pg_node_phase(root) == PG_LAYOUT_NEEDS_COMMIT);
            ++failures;
        }
        remaining = -1;
        CHECK(pg_layout_run(layout) == PG_OK);
        pg_transform position;
        CHECK(pg_node_absolute_transform(tail, &position) == PG_OK);
        pg_layout_free(layout);
        pg_node_free_tree(root);
        CHECK(live == 0);
        if (complete) return failures;
    }
    CHECK(false); return 0;
}

static void failed_update_invalidates_old_positions(void) {
    remaining = -1;
    pg_node *root = pg_node_new(NULL), *child = pg_node_new(NULL);
    CHECK(root && child);
    CHECK(pg_node_set_size(root, 24, 80) == PG_OK);
    CHECK(pg_node_set_size(child, 24, 80) == PG_OK);
    CHECK(pg_node_set_fit(root, PG_FIT_EXACT) == PG_OK);
    CHECK(pg_node_connect(root, PG_FORWARD, child) == PG_OK);
    pg_layout *layout = pg_layout_new(root, NULL); CHECK(layout);
    CHECK(pg_layout_run(layout) == PG_OK);
    pg_transform position;
    CHECK(pg_node_absolute_transform(child, &position) == PG_OK);
    CHECK(position.x == 24);
    CHECK(pg_node_set_size(root, 72, 80) == PG_OK);
    /* Existing body extent allocations are reused. The first failed combine
     * happens after the edge position has already changed from 24 to 48. */
    remaining = 0;
    CHECK(pg_layout_run(layout) == PG_NOMEM);
    remaining = -1;
    CHECK(pg_layout_run(layout) == PG_OK);
    CHECK(pg_node_absolute_transform(child, &position) == PG_OK);
    CHECK(position.x == 48);
    pg_layout_free(layout); pg_node_free_tree(root);
    CHECK(live == 0);
}

int main(void) {
    size_t loose = fail_layout_allocations(PG_FIT_LOOSE, 40);
    size_t exact = fail_layout_allocations(PG_FIT_EXACT, 8);
    failed_update_invalidates_old_positions();
    CHECK(loose > 200 && exact > 100);
    printf("layout allocation failure: %zu loose and %zu exact allocation sites retried without leaks\n", loose, exact);
    return 0;
}
