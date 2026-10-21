#undef malloc
#undef free
#include "parsegraph/extent.h"
#include <stdio.h>
#include <stdlib.h>

#define CHECK(expr) do { if (!(expr)) { \
    fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #expr); exit(1); \
} } while (0)

static int remaining = -1;
static size_t live = 0;

void *pg_test_malloc(size_t size) {
    if (remaining == 0) return NULL;
    if (remaining > 0) --remaining;
    void *p = malloc(size);
    if (p) ++live;
    return p;
}
void pg_test_free(void *p) {
    if (p) { CHECK(live > 0); --live; }
    free(p);
}

int main(void) {
    pg_extent a = {0}, b = {0}, out = {0}, saved = {0};
    for (int i = 0; i < 16; ++i) {
        CHECK(pg_extent_append(&a, 1, i % 3) == PG_OK);
        CHECK(pg_extent_prepend(&b, 2, i % 5) == PG_OK);
    }
    CHECK(pg_extent_append(&out, 3, 99) == PG_OK);
    CHECK(pg_extent_copy(&saved, &out) == PG_OK);
    size_t baseline = live;
    remaining = 0;
    CHECK(pg_extent_reserve(&out, 128) == PG_NOMEM);
    CHECK(pg_extent_copy(&out, &a) == PG_NOMEM);
    CHECK(pg_extent_prepend(&out, 1, 2) == PG_NOMEM);
    CHECK(pg_extent_equals(&out, &saved, 0) && live == baseline);
    int failures = 0;
    for (int limit = 0; limit < 64; ++limit) {
        remaining = limit;
        pg_status status = pg_extent_combine(&out, &a, &b, -3, 2, 0.5);
        if (status == PG_OK) break;
        CHECK(status == PG_NOMEM);
        CHECK(pg_extent_equals(&out, &saved, 0));
        CHECK(live == baseline);
        ++failures;
    }
    CHECK(failures > 3 && failures < 64);
    CHECK(!pg_extent_equals(&out, &saved, 0));
    remaining = -1;
    pg_extent_destroy(&a); pg_extent_destroy(&b);
    pg_extent_destroy(&out); pg_extent_destroy(&saved);
    CHECK(live == 0);
    printf("Allocation failure: %d combine allocation sites checked; no outstanding buffers\n", failures);
    return 0;
}
