#ifndef PARSEGRAPH_EXTENT_H
#define PARSEGRAPH_EXTENT_H

#include <stdbool.h>
#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Prototype API, not a stable ABI. Do not access fields or copy owning structs
 * by assignment. Initialize with {0}; destroy before leaving scope. */
typedef struct pg_bound {
    float length;
    float size; /* NaN represents a gap, not zero. */
} pg_bound;

typedef struct pg_extent {
    pg_bound *bounds;
    size_t count, capacity, start;
    double offset;
    double total_length, min_size, max_size;
    bool cache_valid;
} pg_extent;

typedef enum pg_status {
    PG_OK = 0,
    PG_INVALID,
    PG_RANGE,
    PG_NOMEM
} pg_status;

/* All pointers must be non-null and extents initialized. No internal locking.
 * Failed operations leave destinations unchanged. Lengths must fit positive
 * float32; insertion of zero is a no-op. Sizes may be finite float32 or NaN.
 * Positive finite scales only. No infinity or fast-math support. */
void pg_extent_destroy(pg_extent *extent);
void pg_extent_clear(pg_extent *extent); /* Retains allocation and offset. */
size_t pg_extent_count(const pg_extent *extent);
size_t pg_extent_capacity(const pg_extent *extent);
pg_status pg_extent_reserve(pg_extent *extent, size_t capacity);
pg_status pg_extent_copy(pg_extent *dest, const pg_extent *src); /* Deep copy. */
void pg_extent_move(pg_extent *dest, pg_extent *src); /* Source becomes {0}. */
pg_status pg_extent_set_offset(pg_extent *extent, double offset);
double pg_extent_offset(const pg_extent *extent); /* Metadata, not applied by math. */
pg_status pg_extent_get(const pg_extent *extent, size_t index, pg_bound *out);
pg_status pg_extent_set_length(pg_extent *extent, size_t index, double length);
pg_status pg_extent_set_size(pg_extent *extent, size_t index, double size);
pg_status pg_extent_append(pg_extent *extent, double length, double size);
pg_status pg_extent_prepend(pg_extent *extent, double length, double size);
pg_status pg_extent_adjust_size(pg_extent *extent, double adjustment);
pg_status pg_extent_scale(pg_extent *extent, double factor);
/* Result is NaN outside the extent or in a gap. At an internal endpoint,
 * return the bound on the left (matching TypeScript sizeAt). */
pg_status pg_extent_size_at(const pg_extent *extent, double position, double *out);
void pg_extent_bounding_values(pg_extent *extent, double out[3]); /* length,min,max */
pg_status pg_extent_simplify(pg_extent *extent);
/* Fuzzy comparison is signed, applies to both components, and ignores offset.
 * Zero tolerance means exact equality; two gap sizes compare equal. */
bool pg_extent_equals(const pg_extent *a, const pg_extent *b, double tolerance);
/* Combine is the pointwise maximum after scaling/translating given. Negative
 * displacement shifts the result origin left. Output offset is zero. Output
 * may alias either input; inputs otherwise remain unchanged. */
pg_status pg_extent_combine(pg_extent *out, const pg_extent *base,
                            const pg_extent *given, double displacement,
                            double size_adjustment, double scale);
pg_status pg_extent_combine_bound(pg_extent *extent, double start,
                                  double length, double size);
pg_status pg_extent_combine_simplified(pg_extent *out, const pg_extent *base,
                                       const pg_extent *given, double displacement,
                                       double size_adjustment, double scale);
pg_status pg_extent_separation(const pg_extent *base, const pg_extent *given,
                               double displacement, bool allow_axis_overlap,
                               double scale, double *out);

#ifdef __cplusplus
}
#endif
#endif
