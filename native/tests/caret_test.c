#include "parsegraph/caret.h"
#include <assert.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef PG_CARET_TEST_ALLOCATIONS
/* Compile the same implementation with allocation failures, leaving node
 * allocations in the linked library unaffected. The ordinary caret target
 * above exercises the actual archive symbols. */
static size_t allocation_budget = SIZE_MAX;
static size_t live_allocations = 0;
static bool permit_allocation(void) {
    if (allocation_budget == SIZE_MAX) return true;
    if (!allocation_budget) return false;
    --allocation_budget;
    return true;
}
static void *test_malloc(size_t size) {
    if (!permit_allocation()) return NULL;
    void *p = malloc(size);
    if (p) ++live_allocations;
    return p;
}
static void *test_calloc(size_t count, size_t size) {
    if (!permit_allocation()) return NULL;
    void *p = calloc(count, size);
    if (p) ++live_allocations;
    return p;
}
static void *test_realloc(void *old, size_t size) {
    if (!permit_allocation()) return NULL;
    bool fresh = old == NULL;
    void *p = realloc(old, size);
    if (p && fresh) ++live_allocations;
    return p;
}
static void test_free(void *p) {
    if (p) { assert(live_allocations > 0); --live_allocations; }
    free(p);
}
#define malloc test_malloc
#define calloc test_calloc
#define realloc test_realloc
#define free test_free
#include "../src/caret.c"
#undef malloc
#undef calloc
#undef realloc
#undef free
#endif

static void navigation(void) {
    int a = 1, b = 2, replacement = 3;
    pg_node *root = pg_node_new(&a);
    assert(root);
    pg_caret *c = pg_caret_new(root);
    assert(c && pg_caret_node(c) == root && pg_caret_origin(c) == root);
    assert(pg_caret_root(c) == root && !pg_caret_parent(c));
    assert(pg_caret_depth(c) == 1);
    assert(pg_caret_pop(c) == PG_RANGE);
    assert(pg_caret_move(c, PG_DOWNWARD) == PG_RANGE);
    assert(pg_caret_node(c) == root);
    pg_node *child = NULL;
    assert(pg_caret_spawn_move(c, PG_FORWARD, &b, PG_ALIGN_NULL, &child) == PG_OK);
    assert(child && pg_caret_value(c) == &b && pg_caret_parent(c) == root);
    assert(pg_caret_origin(c) == root && pg_caret_root(c) == root);
    assert(pg_caret_has(c, PG_BACKWARD) && pg_caret_at(c, PG_BACKWARD) == root);
    assert(pg_caret_move(c, PG_BACKWARD) == PG_OK);
    assert(pg_caret_node(c) == root);
    assert(pg_caret_push(c) == PG_OK);
    assert(pg_caret_move(c, PG_FORWARD) == PG_OK);
    assert(pg_caret_depth(c) == 2);
    assert(pg_caret_replace(c, &replacement) == &b);
    assert(pg_node_value(child) == &replacement);
    pg_caret *clone = pg_caret_clone(c);
    assert(clone && pg_caret_origin(clone) == child && pg_caret_depth(clone) == 1);
    assert(pg_caret_pop(c) == PG_OK && pg_caret_node(c) == root);
    assert(pg_caret_node(clone) == child);
    for (int i = 0; i < 1024; ++i) {
        assert(pg_caret_push(c) == PG_OK);
        assert(pg_caret_move_to(c, i % 2 ? root : child) == PG_OK);
    }
    for (int i = 1023; i >= 0; --i) {
        assert(pg_caret_node(c) == (i % 2 ? root : child));
        assert(pg_caret_pop(c) == PG_OK);
    }
    assert(pg_caret_node(c) == root && pg_caret_depth(c) == 1);
    pg_caret_free(clone);
    pg_caret_free(c);
    assert(pg_node_at(root, PG_FORWARD) == child); /* Carets are non-owning. */
    pg_node_free_tree(root);
}

static void marks(void) {
    pg_node *root = pg_node_new(NULL), *other = pg_node_new(NULL);
    assert(root && other);
    pg_caret *c = pg_caret_new(root);
    assert(c);
    assert(pg_caret_restore(c, "missing") == PG_RANGE);
    char name[] = "temporary";
    assert(pg_caret_save(c, name) == PG_OK);
    name[0] = 'x';
    assert(pg_caret_move_to(c, other) == PG_OK);
    assert(pg_caret_restore(c, "temporary") == PG_OK && pg_caret_node(c) == root);
    assert(pg_caret_move_to(c, other) == PG_OK);
    assert(pg_caret_save(c, "temporary") == PG_OK);
    assert(pg_caret_move_to(c, root) == PG_OK);
    assert(pg_caret_restore(c, "temporary") == PG_OK && pg_caret_node(c) == other);
    assert(pg_caret_save(c, "") == PG_OK);
    assert(pg_caret_save(c, "1") == PG_OK);
    const char *auto_key = NULL;
    assert(pg_caret_save_auto(c, &auto_key) == PG_OK);
    assert(strcmp(auto_key, "2") == 0); /* Never overwrites a manual mark. */
    char key[64];
    for (int i = 0; i < 2048; ++i) {
        snprintf(key, sizeof key, "mark-%d", i);
        assert(pg_caret_move_to(c, i % 2 ? other : root) == PG_OK);
        assert(pg_caret_save(c, key) == PG_OK);
    }
    /* Resizing the hash table leaves returned generated keys valid. */
    assert(strcmp(auto_key, "2") == 0);
    for (int i = 2047; i >= 0; --i) {
        snprintf(key, sizeof key, "mark-%d", i);
        assert(pg_caret_restore(c, key) == PG_OK);
        assert(pg_caret_node(c) == (i % 2 ? other : root));
        if (i % 3 == 0) pg_caret_clear_save(c, key);
    }
    pg_caret_clear_save(c, "mark-0");
    assert(pg_caret_restore(c, "mark-0") == PG_RANGE);
    assert(pg_caret_restore(c, "mark-1") == PG_OK);
    pg_caret *clone = pg_caret_clone(c);
    assert(clone && pg_caret_restore(clone, "mark-1") == PG_RANGE);
    pg_caret_free(clone);
    pg_caret_clear_saves(c);
    assert(pg_caret_restore(c, "mark-1") == PG_RANGE);
    assert(pg_caret_save(c, "reused") == PG_OK);
    assert(pg_caret_restore(c, "reused") == PG_OK);
    pg_caret_free(c);
    pg_node_free(root);
    pg_node_free(other);
}

static void targets_and_parent_alignment(void) {
    pg_node *root = pg_node_new(NULL);
    pg_caret *c = pg_caret_new(root);
    assert(c);
    pg_node *inner = NULL;
    assert(pg_caret_spawn(c, PG_INWARD, NULL, PG_ALIGN_NULL, &inner) == PG_OK);
    assert(inner && pg_caret_node(c) == root);
    assert(pg_caret_is_creased(c, PG_DIRECTION_NONE));
    assert(!pg_caret_is_creased(c, PG_INWARD));
    assert(pg_caret_crease(c, PG_INWARD) == PG_OK);
    assert(pg_node_is_creased(inner));
    assert(pg_caret_is_creased(c, PG_INWARD));
    assert(pg_caret_uncrease(c, PG_INWARD) == PG_OK);
    assert(!pg_node_is_creased(inner));
    assert(pg_caret_shrink(c, PG_INWARD) == PG_OK);
    assert(pg_node_scale(inner) == PG_SHRINK_SCALE && pg_node_scale(root) == 1.0);
    assert(pg_caret_shrink(c, PG_DIRECTION_NONE) == PG_OK);
    assert(pg_caret_grow(c, PG_INWARD) == PG_OK);
    assert(pg_node_scale(inner) == 1.0 && pg_node_scale(root) == PG_SHRINK_SCALE);
    assert(pg_caret_fit_exact(c, PG_INWARD) == PG_OK);
    assert(pg_node_fit(inner) == PG_FIT_EXACT && pg_node_fit(root) == PG_FIT_LOOSE);
    assert(pg_caret_fit_naive(c, PG_INWARD) == PG_OK && pg_node_fit(inner) == PG_FIT_NAIVE);
    assert(pg_caret_fit_loose(c, PG_INWARD) == PG_OK && pg_node_fit(inner) == PG_FIT_LOOSE);
    assert(pg_caret_align_parent(c, PG_ALIGN_CENTER) == PG_RANGE);
    assert(pg_caret_move(c, PG_INWARD) == PG_OK);
    assert(pg_caret_align_parent(c, PG_ALIGN_INWARD_VERTICAL) == PG_OK);
    assert(pg_node_alignment(root, PG_INWARD) == PG_ALIGN_INWARD_VERTICAL);
    assert(pg_node_fit(root) == PG_FIT_EXACT);
    assert(pg_node_fit(inner) == PG_FIT_LOOSE);
    assert(pg_caret_move_to(c, root) == PG_OK);
    assert(pg_caret_disconnect(c, PG_INWARD) == inner);
    assert(!pg_caret_has(c, PG_INWARD) && !pg_node_parent(inner));
    assert(pg_caret_node(c) == root);
    assert(pg_caret_connect_move(c, PG_FORWARD, inner) == PG_OK);
    pg_node *child = NULL;
    assert(pg_caret_spawn_move(c, PG_DOWNWARD, NULL, PG_ALIGN_NULL, &child) == PG_OK);
    assert(pg_caret_align_parent(c, PG_ALIGN_NEGATIVE) == PG_OK);
    assert(pg_node_alignment(inner, PG_DOWNWARD) == PG_ALIGN_NEGATIVE);
    assert(pg_node_alignment(inner, PG_FORWARD) == PG_ALIGN_NULL);
    assert(pg_node_set_fit(inner, PG_FIT_LOOSE) == PG_OK);
    assert(pg_caret_align(c, PG_UPWARD, PG_ALIGN_CENTER) == PG_OK);
    assert(pg_node_alignment(inner, PG_DOWNWARD) == PG_ALIGN_CENTER);
    assert(pg_node_fit(inner) == PG_FIT_EXACT);
    assert(pg_node_fit(child) == PG_FIT_LOOSE);
    assert(pg_node_set_fit(inner, PG_FIT_LOOSE) == PG_OK);
    assert(pg_caret_align(c, PG_DIRECTION_NONE, PG_ALIGN_POSITIVE) == PG_OK);
    assert(pg_node_alignment(inner, PG_DOWNWARD) == PG_ALIGN_POSITIVE);
    assert(pg_node_fit(inner) == PG_FIT_EXACT);
    assert(pg_node_fit(child) == PG_FIT_LOOSE);
    assert(pg_caret_disconnect(c, PG_DIRECTION_NONE) == child);
    assert(pg_caret_root(c) == child && pg_caret_origin(c) == root);
    assert(!pg_node_at(inner, PG_DOWNWARD));
    assert(pg_caret_disconnect(c, PG_DIRECTION_NONE) == child);
    pg_caret_free(c);
    pg_node_free_tree(root);
    pg_node_free(child);
}

static void spawn_and_errors(void) {
    pg_node *root = pg_node_new(NULL);
    pg_caret *c = pg_caret_new(root);
    assert(c);
    assert(pg_caret_fit_naive(c, PG_DIRECTION_NONE) == PG_OK);
    pg_node *first = NULL, *second = NULL;
    assert(pg_caret_spawn(c, PG_DOWNWARD, NULL, PG_ALIGN_NONE, &first) == PG_OK);
    assert(pg_node_fit(first) == PG_FIT_NAIVE && pg_node_fit(root) == PG_FIT_NAIVE);
    assert(pg_node_preferred_axis(first) == PG_PREFERRED_PERPENDICULAR);
    assert(pg_caret_spawn(c, PG_DOWNWARD, NULL, PG_ALIGN_CENTER, &second) == PG_OK);
    assert(pg_node_at(root, PG_DOWNWARD) == second);
    assert(!pg_node_parent(first)); /* Caller must release the displaced node. */
    assert(pg_node_fit(second) == PG_FIT_NAIVE && pg_node_fit(root) == PG_FIT_EXACT);
    assert(pg_node_alignment(root, PG_DOWNWARD) == PG_ALIGN_CENTER);
    assert(pg_caret_pull(c, PG_FORWARD) == PG_OK);
    assert(pg_node_preferred_axis(root) == PG_PREFERRED_HORIZONTAL);
    pg_node *out = root;
    assert(pg_caret_spawn(c, PG_DIRECTION_NONE, NULL, PG_ALIGN_NULL, &out) == PG_INVALID && !out);
    assert(pg_caret_spawn(c, PG_DOWNWARD, NULL, (pg_alignment)999, &out) == PG_INVALID && !out);
    assert(pg_node_at(root, PG_DOWNWARD) == second);
    assert(pg_caret_move(c, (pg_direction)999) == PG_INVALID);
    assert(pg_caret_move_to(c, NULL) == PG_INVALID);
    assert(pg_caret_crease(c, PG_UPWARD) == PG_RANGE);
    assert(pg_caret_uncrease(c, PG_UPWARD) == PG_RANGE);
    assert(pg_caret_shrink(c, PG_UPWARD) == PG_RANGE);
    assert(pg_caret_grow(c, PG_UPWARD) == PG_RANGE);
    assert(pg_caret_fit_exact(c, PG_UPWARD) == PG_RANGE);
    assert(pg_caret_set_fit(c, PG_DIRECTION_NONE, (pg_fit)999) == PG_INVALID);
    assert(pg_caret_fit_exact(c, (pg_direction)999) == PG_INVALID);
    assert(!pg_caret_new(NULL) && !pg_caret_clone(NULL));
    assert(!pg_caret_node(NULL) && !pg_caret_origin(NULL) && !pg_caret_value(NULL));
    assert(pg_caret_push(NULL) == PG_INVALID && pg_caret_pop(NULL) == PG_INVALID);
    assert(pg_caret_save(c, NULL) == PG_INVALID && pg_caret_restore(c, NULL) == PG_INVALID);
    assert(pg_caret_save_auto(c, NULL) == PG_INVALID);
    assert(pg_caret_align_parent(NULL, PG_ALIGN_CENTER) == PG_INVALID);
    assert(pg_caret_connect(c, PG_FORWARD, root) == PG_INVALID);
    assert(pg_caret_node(c) == root);
    pg_caret_free(NULL);
    pg_caret_free(c);
    pg_node_free_tree(root);
    pg_node_free(first);
}

#ifdef PG_CARET_TEST_ALLOCATIONS
static void allocation_failures(void) {
    pg_node *root = pg_node_new(NULL), *other = pg_node_new(NULL);
    assert(root && other && live_allocations == 0);
    for (size_t budget = 0; budget < 2; ++budget) {
        allocation_budget = budget;
        assert(!pg_caret_new(root));
        assert(live_allocations == 0);
    }
    allocation_budget = SIZE_MAX;
    pg_caret *c = pg_caret_new(root);
    assert(c && live_allocations == 2);
    for (size_t i = 1; i < 8; ++i) assert(pg_caret_push(c) == PG_OK);
    allocation_budget = 0;
    assert(pg_caret_push(c) == PG_NOMEM);
    assert(pg_caret_depth(c) == 8 && pg_caret_node(c) == root);
    assert(live_allocations == 2);
    allocation_budget = SIZE_MAX;
    assert(pg_caret_push(c) == PG_OK && pg_caret_depth(c) == 9);
    for (size_t budget = 0; budget < 3; ++budget) {
        allocation_budget = budget;
        assert(pg_caret_save(c, "first") == PG_NOMEM);
        assert(pg_caret_restore(c, "first") == PG_RANGE);
        assert(pg_caret_node(c) == root && live_allocations == 2);
    }
    allocation_budget = SIZE_MAX;
    char key[32];
    for (int i = 0; i < 12; ++i) {
        snprintf(key, sizeof key, "mark-%d", i);
        assert(pg_caret_save(c, key) == PG_OK);
    }
    size_t before_growth = live_allocations;
    for (size_t budget = 0; budget < 3; ++budget) {
        allocation_budget = budget;
        assert(pg_caret_save(c, "grow") == PG_NOMEM);
        assert(live_allocations == before_growth);
        assert(pg_caret_restore(c, "grow") == PG_RANGE);
        assert(pg_caret_restore(c, "mark-11") == PG_OK);
        assert(pg_caret_node(c) == root);
    }
    allocation_budget = 0;
    assert(pg_caret_move_to(c, other) == PG_OK);
    assert(pg_caret_save(c, "mark-11") == PG_OK); /* Overwrite needs no allocation. */
    assert(pg_caret_move_to(c, root) == PG_OK);
    assert(pg_caret_restore(c, "mark-11") == PG_OK && pg_caret_node(c) == other);
    allocation_budget = SIZE_MAX;
    assert(pg_caret_save(c, "grow") == PG_OK);
    pg_caret_free(c);
    assert(live_allocations == 0);
    pg_node_free(root);
    pg_node_free(other);
}
#endif

int main(void) {
    navigation(); marks(); targets_and_parent_alignment(); spawn_and_errors();
#ifdef PG_CARET_TEST_ALLOCATIONS
    assert(live_allocations == 0);
    allocation_failures();
#endif
    puts("caret ownership, navigation, marks, construction, and mutation tests passed");
    return 0;
}
