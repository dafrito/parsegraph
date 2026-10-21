#include "parsegraph/extent.h"

#include <float.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

_Static_assert(sizeof(float) == 4 && FLT_RADIX == 2 && FLT_MANT_DIG == 24,
               "Extent requires binary32 floats");
_Static_assert(sizeof(pg_bound) == 8, "Two floats per bound");

/* Avoid start + index overflow even for very large capacities. */
static size_t slot(const pg_extent *e, size_t index) {
    size_t tail = e->capacity - e->start;
    return index < tail ? e->start + index : index - tail;
}

static pg_bound bound(const pg_extent *e, size_t i) {
    return e->bounds[slot(e, i)];
}

static bool valid_size(double value) {
    return isnan(value) || (isfinite(value) && fabs(value) <= FLT_MAX);
}

static bool valid_length(double value) {
    return isfinite(value) && value > 0 && value <= FLT_MAX && (float)value > 0;
}

static bool same_size(double a, double b) {
    return a == b || (isnan(a) && isnan(b));
}

static double max_size(double a, double b) {
    return isnan(a) ? b : isnan(b) ? a : fmax(a, b);
}

void pg_extent_destroy(pg_extent *e) {
    free(e->bounds);
    *e = (pg_extent){0};
}

void pg_extent_clear(pg_extent *e) {
    e->count = 0;
    e->start = 0;
    e->cache_valid = false;
}

size_t pg_extent_count(const pg_extent *e) { return e->count; }
size_t pg_extent_capacity(const pg_extent *e) { return e->capacity; }
double pg_extent_offset(const pg_extent *e) { return e->offset; }

pg_status pg_extent_set_offset(pg_extent *e, double value) {
    if (!isfinite(value)) return PG_INVALID;
    e->offset = value;
    return PG_OK;
}

pg_status pg_extent_reserve(pg_extent *e, size_t capacity) {
    if (capacity <= e->capacity) return PG_OK;
    if (capacity > SIZE_MAX / sizeof(pg_bound)) return PG_RANGE;
    pg_bound *data = malloc(capacity * sizeof(*data));
    if (!data) return PG_NOMEM;
    if (e->count) {
        size_t tail = e->capacity - e->start;
        if (tail > e->count) tail = e->count;
        memcpy(data, e->bounds + e->start, tail * sizeof(*data));
        if (tail < e->count)
            memcpy(data + tail, e->bounds, (e->count - tail) * sizeof(*data));
    }
    free(e->bounds);
    e->bounds = data;
    e->capacity = capacity;
    e->start = 0;
    return PG_OK;
}

pg_status pg_extent_copy(pg_extent *dest, const pg_extent *src) {
    if (dest == src) return PG_OK;
    pg_extent temp = {0};
    pg_status status = pg_extent_reserve(&temp, src->count);
    if (status != PG_OK) return status;
    for (size_t i = 0; i < src->count; ++i) temp.bounds[i] = bound(src, i);
    temp.count = src->count;
    temp.offset = src->offset;
    pg_extent_move(dest, &temp);
    return PG_OK;
}

void pg_extent_move(pg_extent *dest, pg_extent *src) {
    if (dest == src) return;
    pg_extent_destroy(dest);
    *dest = *src;
    *src = (pg_extent){0};
}

pg_status pg_extent_get(const pg_extent *e, size_t index, pg_bound *out) {
    if (index >= e->count) return PG_RANGE;
    *out = bound(e, index);
    return PG_OK;
}

pg_status pg_extent_set_length(pg_extent *e, size_t index, double length) {
    if (index >= e->count) return PG_RANGE;
    if (!valid_length(length)) return PG_INVALID;
    e->bounds[slot(e, index)].length = (float)length;
    e->cache_valid = false;
    return PG_OK;
}

pg_status pg_extent_set_size(pg_extent *e, size_t index, double size) {
    if (index >= e->count) return PG_RANGE;
    if (!valid_size(size)) return PG_INVALID;
    e->bounds[slot(e, index)].size = (float)size;
    e->cache_valid = false;
    return PG_OK;
}

static pg_status insert(pg_extent *e, double length, double size, bool front) {
    if (length == 0) return PG_OK;
    if (!valid_length(length) || !valid_size(size)) return PG_INVALID;
    if (e->count) {
        size_t index = front ? 0 : e->count - 1;
        pg_bound last = bound(e, index);
        /* Compare the incoming double before storage rounding, as TS does. */
        if (same_size(last.size, size))
            return pg_extent_set_length(e, index, last.length + length);
    }
    if (e->count == e->capacity) {
        if (e->capacity > SIZE_MAX / 2) return PG_RANGE;
        pg_status status = pg_extent_reserve(e, e->capacity ? e->capacity * 2 : 1);
        if (status != PG_OK) return status;
    }
    if (front) e->start = e->start ? e->start - 1 : e->capacity - 1;
    size_t index = front ? 0 : e->count;
    e->bounds[slot(e, index)] = (pg_bound){(float)length, (float)size};
    ++e->count;
    e->cache_valid = false;
    return PG_OK;
}

pg_status pg_extent_append(pg_extent *e, double length, double size) {
    return insert(e, length, size, false);
}
pg_status pg_extent_prepend(pg_extent *e, double length, double size) {
    return insert(e, length, size, true);
}

pg_status pg_extent_adjust_size(pg_extent *e, double adjustment) {
    if (!isfinite(adjustment)) return PG_INVALID;
    for (size_t i = 0; i < e->count; ++i)
        if (!valid_size((double)bound(e, i).size + adjustment)) return PG_RANGE;
    for (size_t i = 0; i < e->count; ++i)
        e->bounds[slot(e, i)].size = (float)((double)bound(e, i).size + adjustment);
    e->cache_valid = false;
    return PG_OK;
}

pg_status pg_extent_scale(pg_extent *e, double factor) {
    if (!isfinite(factor) || factor <= 0) return PG_INVALID;
    for (size_t i = 0; i < e->count; ++i) {
        pg_bound b = bound(e, i);
        if (!valid_length(b.length * factor) || !valid_size(b.size * factor))
            return PG_RANGE;
    }
    for (size_t i = 0; i < e->count; ++i) {
        pg_bound *b = &e->bounds[slot(e, i)];
        b->length = (float)(b->length * factor);
        b->size = (float)(b->size * factor);
    }
    e->cache_valid = false;
    return PG_OK;
}

pg_status pg_extent_size_at(const pg_extent *e, double position, double *out) {
    if (!isfinite(position) || position < 0) return PG_INVALID;
    double end = 0;
    for (size_t i = 0; i < e->count; ++i) {
        pg_bound b = bound(e, i);
        end += b.length;
        if (position <= end) { *out = b.size; return PG_OK; }
    }
    *out = NAN;
    return PG_OK;
}

void pg_extent_bounding_values(pg_extent *e, double out[3]) {
    if (!e->cache_valid) {
        e->total_length = 0;
        e->min_size = e->max_size = NAN;
        for (size_t i = 0; i < e->count; ++i) {
            pg_bound b = bound(e, i);
            e->total_length += b.length;
            e->min_size = isnan(e->min_size) ? b.size :
                isnan(b.size) ? e->min_size : fmin(e->min_size, b.size);
            e->max_size = max_size(e->max_size, b.size);
        }
        e->cache_valid = true;
    }
    out[0] = e->total_length;
    out[1] = e->min_size;
    out[2] = e->max_size;
}

pg_status pg_extent_simplify(pg_extent *e) {
    double values[3];
    /* Do not mutate even the cache on failure. */
    pg_extent view = *e;
    pg_extent_bounding_values(&view, values);
    if (e->count && !valid_length(values[0])) return PG_RANGE;
    if (e->count) {
        e->bounds[0] = (pg_bound){(float)values[0], (float)values[2]};
        e->count = 1;
    }
    e->start = 0;
    e->cache_valid = false;
    return PG_OK;
}

static bool near(double a, double b, double tolerance) {
    return a == b || (tolerance > 0 && fabs(a - b) < tolerance);
}

bool pg_extent_equals(const pg_extent *a, const pg_extent *b, double tolerance) {
    if (!isfinite(tolerance) || tolerance < 0 || a->count != b->count) return false;
    for (size_t i = 0; i < a->count; ++i) {
        pg_bound x = bound(a, i), y = bound(b, i);
        if (!near(x.length, y.length, tolerance) ||
            !(same_size(x.size, y.size) || near(x.size, y.size, tolerance)))
            return false;
    }
    return true;
}

/* Every iteration consumes at least one bound; no arbitrary timeout needed. */
static pg_status combine_zero(pg_extent *out, const pg_extent *a,
                              const pg_extent *b, double adjust, double scale) {
    size_t i = 0, j = 0;
    double ap = 0, bp = 0;
    pg_status status;
    while (i < a->count && j < b->count) {
        pg_bound x = bound(a, i), y = bound(b, j);
        double ae = ap + x.length, be = bp + scale * y.length;
        status = pg_extent_append(out, fmin(ae, be) - fmax(ap, bp),
                                  max_size(x.size, scale * y.size + adjust));
        if (status != PG_OK) return status;
        if (ae <= be) { ap = ae; ++i; }
        if (be <= ae) { bp = be; ++j; }
    }
    if (j < b->count) {
        pg_bound y = bound(b, j);
        status = pg_extent_append(out, bp + scale * y.length - ap,
                                  scale * y.size + adjust);
        if (status != PG_OK) return status;
        while (++j < b->count) {
            y = bound(b, j);
            status = pg_extent_append(out, scale * y.length, scale * y.size + adjust);
            if (status != PG_OK) return status;
        }
    } else if (i < a->count) {
        pg_bound x = bound(a, i);
        status = pg_extent_append(out, ap + x.length - bp, x.size);
        if (status != PG_OK) return status;
        while (++i < a->count) {
            x = bound(a, i);
            status = pg_extent_append(out, x.length, x.size);
            if (status != PG_OK) return status;
        }
    }
    return PG_OK;
}

pg_status pg_extent_combine(pg_extent *out, const pg_extent *a,
                            const pg_extent *b, double displacement,
                            double adjustment, double scale) {
    if (!isfinite(displacement) || !isfinite(adjustment) ||
        !isfinite(scale) || scale <= 0) return PG_INVALID;
    pg_extent result = {0}, padded = {0};
    pg_status status;
    if (displacement < 0) {
        status = pg_extent_combine(&result, b, a, -displacement / scale,
                                    -adjustment / scale, 1 / scale);
        if (status == PG_OK) status = pg_extent_scale(&result, scale);
        if (status == PG_OK) status = pg_extent_adjust_size(&result, adjustment);
    } else {
        if (displacement > 0) {
            status = pg_extent_copy(&padded, b);
            if (status != PG_OK) goto finish;
            status = pg_extent_prepend(&padded, displacement / scale, NAN);
            if (status != PG_OK) goto finish;
            b = &padded;
        }
        status = combine_zero(&result, a, b, adjustment, scale);
    }
finish:
    pg_extent_destroy(&padded);
    if (status == PG_OK) pg_extent_move(out, &result);
    pg_extent_destroy(&result);
    return status;
}

pg_status pg_extent_combine_bound(pg_extent *e, double start, double length, double size) {
    pg_extent added = {0};
    pg_status status = pg_extent_append(&added, length, size);
    if (status == PG_OK) status = pg_extent_combine(e, e, &added, start, 0, 1);
    pg_extent_destroy(&added);
    return status;
}

pg_status pg_extent_combine_simplified(pg_extent *out, const pg_extent *a,
                                       const pg_extent *b, double displacement,
                                       double adjustment, double scale) {
    if (!isfinite(displacement) || !isfinite(adjustment) ||
        !isfinite(scale) || scale <= 0) return PG_INVALID;
    pg_extent av = *a, bv = *b, result = {0};
    double x[3], y[3];
    pg_extent_bounding_values(&av, x);
    pg_extent_bounding_values(&bv, y);
    double length = displacement < 0 ? fmax(x[0] - displacement, y[0] * scale) :
        fmax(x[0], y[0] * scale + displacement);
    /* Preserve JS Math.max's NaN propagation in this shortcut. */
    double size = isnan(x[2]) || isnan(y[2]) ? NAN : fmax(x[2], y[2] * scale + adjustment);
    pg_status status = pg_extent_append(&result, length, size);
    if (status == PG_OK) pg_extent_move(out, &result);
    pg_extent_destroy(&result);
    return status;
}

pg_status pg_extent_separation(const pg_extent *a, const pg_extent *b,
                               double displacement, bool overlap, double scale,
                               double *out) {
    if (!isfinite(displacement) || !isfinite(scale) || scale <= 0) return PG_INVALID;
    size_t i = 0, j = 0;
    double ap = 0, bp = 0, separation = 0;
    if (displacement < 0) {
        while (j < b->count && bp + scale * bound(b, j).length <= -displacement) {
            pg_bound y = bound(b, j++);
            if (!overlap && !isnan(y.size)) separation = fmax(separation, scale * y.size);
            bp += scale * y.length;
        }
    } else {
        while (i < a->count && ap + bound(a, i).length <= displacement) {
            pg_bound x = bound(a, i++);
            if (!overlap && !isnan(x.size)) separation = fmax(separation, x.size);
            ap += x.length;
        }
    }
    /* A partially skipped first bound also has a span facing the bare axis.
     * This matters when negative sizes reduce the later overlapping sum. */
    if (!overlap && displacement > ap && i < a->count) {
        double size = bound(a, i).size;
        if (!isnan(size)) separation = fmax(separation, size);
    }
    if (!overlap && -displacement > bp && j < b->count) {
        double size = scale * bound(b, j).size;
        if (!isnan(size)) separation = fmax(separation, size);
    }
    while (i < a->count && j < b->count) {
        pg_bound x = bound(a, i), y = bound(b, j);
        double ys = scale * y.size, candidate = 0;
        if (!isnan(x.size) && !isnan(ys)) candidate = x.size + ys;
        else if (!overlap) candidate = isnan(x.size) ? (isnan(ys) ? 0 : ys) : x.size;
        separation = fmax(separation, candidate);
        double delta = ap + x.length - displacement - (bp + scale * y.length);
        if (!isfinite(delta)) return PG_RANGE;
        if (delta <= 0) { ap += x.length; ++i; }
        if (delta >= 0) { bp += scale * y.length; ++j; }
    }
    if (!overlap) {
        /* Include BOTH tails. TS currently omits the base tail. */
        while (i < a->count) {
            double size = bound(a, i++).size;
            if (!isnan(size)) separation = fmax(separation, size);
        }
        while (j < b->count) {
            double size = scale * bound(b, j++).size;
            if (!isnan(size)) separation = fmax(separation, size);
        }
    }
    if (!isfinite(separation)) return PG_RANGE;
    *out = separation;
    return PG_OK;
}
