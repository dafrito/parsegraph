#include "parsegraph/extent.h"
#include <float.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>

#define CHECK(expr) do { if (!(expr)) { \
    fprintf(stderr, "%s:%d: %s\n", __FILE__, __LINE__, #expr); exit(1); \
} } while (0)
#define OK(expr) CHECK((expr) == PG_OK)

static void expect_bound(const pg_extent *e, size_t i, double length, double size) {
    pg_bound b;
    OK(pg_extent_get(e, i, &b));
    CHECK(b.length == length);
    CHECK(b.size == size || (isnan(b.size) && isnan(size)));
}

static void storage(void) {
    pg_extent e = {0}, copy = {0}, moved = {0};
    double values[3], size;
    pg_extent_bounding_values(&e, values);
    CHECK(values[0] == 0 && isnan(values[1]) && isnan(values[2]));
    OK(pg_extent_set_offset(&e, 42));
    OK(pg_extent_prepend(&e, 1, 10));
    OK(pg_extent_prepend(&e, 2, 20));
    OK(pg_extent_prepend(&e, 3, 30));
    expect_bound(&e, 0, 3, 30);
    expect_bound(&e, 1, 2, 20);
    expect_bound(&e, 2, 1, 10);
    OK(pg_extent_append(&e, 4, NAN));
    OK(pg_extent_append(&e, 5, NAN));
    OK(pg_extent_prepend(&e, 2, 30));
    CHECK(pg_extent_count(&e) == 4);
    expect_bound(&e, 0, 5, 30);
    expect_bound(&e, 3, 9, NAN);
    OK(pg_extent_copy(&copy, &e));
    CHECK(pg_extent_equals(&copy, &e, 0));
    OK(pg_extent_reserve(&e, 32));
    expect_bound(&e, 3, 9, NAN);
    OK(pg_extent_copy(&copy, &e));
    CHECK(pg_extent_equals(&copy, &e, 0));
    OK(pg_extent_set_size(&copy, 0, -30));
    CHECK(!pg_extent_equals(&copy, &e, 1e-6));
    expect_bound(&e, 0, 5, 30);
    pg_extent_move(&moved, &copy);
    CHECK(copy.bounds == NULL && pg_extent_count(&copy) == 0);
    CHECK(pg_extent_offset(&moved) == 42);
    OK(pg_extent_append(&copy, 1, 999));
    expect_bound(&moved, 0, 5, -30);
    OK(pg_extent_size_at(&e, 5, &size)); CHECK(size == 30);
    OK(pg_extent_size_at(&e, 5.5, &size)); CHECK(size == 20);
    OK(pg_extent_size_at(&e, 18, &size)); CHECK(isnan(size));
    pg_extent_bounding_values(&e, values);
    CHECK(values[0] == 17 && values[1] == 10 && values[2] == 30);
    OK(pg_extent_adjust_size(&e, -5));
    OK(pg_extent_scale(&e, 2));
    pg_extent_bounding_values(&e, values);
    CHECK(values[0] == 34 && values[1] == 10 && values[2] == 50);
    OK(pg_extent_simplify(&e)); expect_bound(&e, 0, 34, 50);
    size_t capacity = pg_extent_capacity(&e);
    pg_extent_clear(&e);
    CHECK(pg_extent_capacity(&e) == capacity && pg_extent_offset(&e) == 42);
    OK(pg_extent_append(&e, 3, NAN));
    pg_extent_bounding_values(&e, values);
    CHECK(values[0] == 3 && isnan(values[1]) && isnan(values[2]));
    OK(pg_extent_set_size(&e, 0, 2));
    pg_extent_bounding_values(&e, values); CHECK(values[1] == 2);
    pg_extent_destroy(&e); pg_extent_destroy(&copy); pg_extent_destroy(&moved);
    pg_extent_destroy(&e); /* Destroy and reuse are safe. */
}

static uint32_t state = 12345;
static uint32_t random_word(void) { state = state * 1664525u + 1013904223u; return state; }

static void ring_stress(void) {
    /* Independent flat-list model, deliberately alternating both ends through
     * wrapping, growth, reservation, clear/reuse and direct edits. */
    pg_extent e = {0};
    pg_bound model[2048];
    size_t n = 0;
    for (size_t step = 0; step < 10000; ++step) {
        if (n == 2048 || step % 193 == 0) { pg_extent_clear(&e); n = 0; }
        bool front = (random_word() >> 16) & 1;
        float length = (float)(1 + random_word() % 20);
        float size = (random_word() % 5 == 0) ? NAN : (float)(random_word() % 17);
        bool merge = n && ((front ? model[0].size : model[n-1].size) == size ||
            (isnan(size) && isnan(front ? model[0].size : model[n-1].size)));
        if (merge) model[front ? 0 : n-1].length += length;
        else {
            if (front) for (size_t i = n; i > 0; --i) model[i] = model[i-1];
            model[front ? 0 : n] = (pg_bound){length, size};
            ++n;
        }
        OK(front ? pg_extent_prepend(&e, length, size) : pg_extent_append(&e, length, size));
        if (step % 23 == 0) OK(pg_extent_reserve(&e, pg_extent_capacity(&e) + 1));
        if (step % 11 == 0) {
            size_t i = random_word() % n;
            model[i].size = -10;
            OK(pg_extent_set_size(&e, i, -10));
        }
        CHECK(pg_extent_count(&e) == n);
        for (size_t i = 0; i < n; ++i) expect_bound(&e, i, model[i].length, model[i].size);
    }
    pg_extent_destroy(&e);
}

static void algorithms(void) {
    pg_extent a = {0}, b = {0}, out = {0};
    double sep;
    OK(pg_extent_append(&a, 50, 25)); OK(pg_extent_append(&b, 12, 6));
    OK(pg_extent_separation(&a, &b, 0, true, 1, &sep)); CHECK(sep == 31);
    OK(pg_extent_combine(&out, &a, &b, 19, sep, 1));
    CHECK(pg_extent_count(&out) == 3);
    expect_bound(&out, 0, 19, 25); expect_bound(&out, 1, 12, 37); expect_bound(&out, 2, 19, 25);
    OK(pg_extent_combine(&a, &a, &b, 19, sep, 1)); CHECK(pg_extent_equals(&a, &out, 0));
    OK(pg_extent_combine_simplified(&b, &a, &b, 19, 31, 1));
    expect_bound(&b, 0, 50, 37);
    pg_extent_clear(&a); pg_extent_clear(&b);
    OK(pg_extent_prepend(&a, 1, 100)); OK(pg_extent_prepend(&a, 1, 1));
    OK(pg_extent_append(&b, 1, 1));
    OK(pg_extent_separation(&a, &b, 0, false, 1, &sep)); CHECK(sep == 100);
    OK(pg_extent_separation(&b, &a, 0, false, 1, &sep)); CHECK(sep == 100);
    OK(pg_extent_separation(&a, &b, 0, true, 1, &sep)); CHECK(sep == 2);
    pg_extent_clear(&a); pg_extent_clear(&b);
    OK(pg_extent_append(&a, 2, -1)); OK(pg_extent_append(&b, 2, 10));
    OK(pg_extent_separation(&a, &b, -1, false, 1, &sep)); CHECK(sep == 10);
    pg_extent_clear(&a); pg_extent_clear(&b);
    OK(pg_extent_append(&a, 1, 1)); OK(pg_extent_append(&b, 1, 1.01));
    CHECK(pg_extent_equals(&a, &b, 0.1));
    CHECK(!pg_extent_equals(&a, &b, 0));
    pg_extent_clear(&a); pg_extent_clear(&b);
    OK(pg_extent_append(&a, 4, NAN)); OK(pg_extent_append(&b, 2, 3));
    OK(pg_extent_combine(&out, &a, &b, -2, 1, 2));
    expect_bound(&out, 0, 4, 7); expect_bound(&out, 1, 2, NAN);
    OK(pg_extent_combine_bound(&out, 1, 2, 8));
    expect_bound(&out, 0, 1, 7); expect_bound(&out, 1, 2, 8);
    expect_bound(&out, 2, 1, 7); expect_bound(&out, 3, 2, NAN);
    pg_extent_destroy(&a); pg_extent_destroy(&b); pg_extent_destroy(&out);
}

/* From Extent.spec.ts: separation must stay symmetric as appended bounds
 * change the maximum, including when one side coalesces and the other does not. */
static void inherited_separation(void) {
    pg_extent a = {0}, b = {0};
    const double a_sizes[] = {10, 20, 40, 10};
    const double b_sizes[] = {10, 20, 20, 10};
    const double expected[] = {20, 40, 60, 60};
    for (size_t i = 0; i < 4; ++i) {
        double ab, ba;
        OK(pg_extent_append(&a, 50, a_sizes[i]));
        OK(pg_extent_append(&b, 50, b_sizes[i]));
        OK(pg_extent_separation(&a, &b, 0, true, 1, &ab));
        OK(pg_extent_separation(&b, &a, 0, true, 1, &ba));
        CHECK(ab == expected[i] && ba == expected[i]);
    }
    pg_extent_destroy(&a); pg_extent_destroy(&b);
}

/* Fixed expected bounds from the original zero-offset and NaN combination
 * tests, independent of both the TS oracle and native equality implementation. */
static void inherited_combinations(void) {
    pg_extent a = {0}, b = {0}, result = {0};
    double separation;
    OK(pg_extent_append(&a, 50, 25));
    OK(pg_extent_append(&b, 12, 6));
    OK(pg_extent_separation(&a, &b, 0, true, 1, &separation));
    CHECK(separation == 31);
    OK(pg_extent_combine(&result, &a, &b, 0, separation, 1));
    CHECK(pg_extent_count(&result) == 2);
    expect_bound(&result, 0, 12, 37);
    expect_bound(&result, 1, 38, 25);

    pg_extent_clear(&b);
    OK(pg_extent_append(&b, 10, NAN));
    OK(pg_extent_set_size(&b, 0, NAN));
    expect_bound(&b, 0, 10, NAN);
    OK(pg_extent_append(&b, 30, 5));
    OK(pg_extent_separation(&a, &b, 0, true, 1, &separation));
    CHECK(separation == 30);
    OK(pg_extent_combine(&result, &a, &b, 0, separation, 1));
    CHECK(pg_extent_count(&result) == 3);
    expect_bound(&result, 0, 10, 25);
    expect_bound(&result, 1, 30, 35);
    expect_bound(&result, 2, 10, 25);
    pg_extent_destroy(&a); pg_extent_destroy(&b); pg_extent_destroy(&result);
}

static void inherited_gap_equality(void) {
    pg_extent a = {0}, b = {0};
    const double sizes[] = {10, NAN, 15};
    for (size_t i = 0; i < 3; ++i) {
        OK(pg_extent_append(&a, 10, sizes[i]));
        OK(pg_extent_append(&b, 10, sizes[i]));
    }
    CHECK(pg_extent_equals(&a, &b, 1e-6));
    /* Strengthen the original test: a gap must not compare equal to zero. */
    OK(pg_extent_set_size(&b, 1, 0));
    CHECK(!pg_extent_equals(&a, &b, 1e-6));
    CHECK(!pg_extent_equals(&b, &a, 1e-6));
    pg_extent_destroy(&a); pg_extent_destroy(&b);
}

static void invalid_and_atomic(void) {
    pg_extent e = {0}, saved = {0}, b = {0};
    pg_bound out = {7, 8};
    double value = 123;
    OK(pg_extent_append(&e, 1, 2));
    OK(pg_extent_append(&e, 1, FLT_MAX));
    OK(pg_extent_copy(&saved, &e));
    CHECK(pg_extent_append(&e, -1, 2) == PG_INVALID);
    CHECK(pg_extent_append(&e, NAN, 2) == PG_INVALID);
    CHECK(pg_extent_append(&e, INFINITY, 2) == PG_INVALID);
    CHECK(pg_extent_append(&e, 1, INFINITY) == PG_INVALID);
    CHECK(pg_extent_append(&e, DBL_MIN, 2) == PG_INVALID);
    CHECK(pg_extent_get(&e, 2, &out) == PG_RANGE && out.length == 7);
    CHECK(pg_extent_set_length(&e, 0, 0) == PG_INVALID);
    CHECK(pg_extent_reserve(&e, SIZE_MAX) == PG_RANGE);
    CHECK(pg_extent_scale(&e, 2) == PG_RANGE);
    CHECK(pg_extent_scale(&e, 0) == PG_INVALID);
    CHECK(pg_extent_adjust_size(&e, FLT_MAX) == PG_RANGE);
    CHECK(pg_extent_size_at(&e, -1, &value) == PG_INVALID && value == 123);
    OK(pg_extent_append(&b, 1, 3));
    CHECK(pg_extent_combine(&e, &e, &b, 0, 0, INFINITY) == PG_INVALID);
    CHECK(pg_extent_combine(&e, &b, &saved, 0, 0, 2) != PG_OK);
    CHECK(pg_extent_equals(&e, &saved, 0));
    OK(pg_extent_copy(&e, &e)); pg_extent_move(&e, &e);
    CHECK(pg_extent_equals(&e, &saved, 0));
    pg_extent_destroy(&e); pg_extent_destroy(&saved); pg_extent_destroy(&b);
}

int main(void) {
    storage(); ring_stress(); algorithms(); invalid_and_atomic();
    inherited_separation(); inherited_combinations(); inherited_gap_equality();
    puts("C extent: inherited scenarios, storage/model stress, algorithms, ownership and error checks passed");
    return 0;
}
