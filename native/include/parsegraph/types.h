#ifndef PARSEGRAPH_TYPES_H
#define PARSEGRAPH_TYPES_H

#include "parsegraph/extent.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Numeric values match the TypeScript API and serialized graph records. */
typedef enum pg_direction {
    PG_DIRECTION_NONE = -1,
    PG_INWARD = 0, PG_OUTWARD = 1,
    PG_DOWNWARD = 2, PG_UPWARD = 3,
    PG_FORWARD = 4, PG_BACKWARD = 5
} pg_direction;
enum { PG_NUM_DIRECTIONS = 6, PG_NUM_CARDINAL_DIRECTIONS = 4 };

typedef enum pg_axis {
    PG_AXIS_NONE = -1, PG_HORIZONTAL = 6, PG_VERTICAL = 7, PG_Z = 8
} pg_axis;
typedef enum pg_fit {
    PG_FIT_NULL = 14, PG_FIT_EXACT, PG_FIT_LOOSE, PG_FIT_NAIVE
} pg_fit;
typedef enum pg_alignment {
    PG_ALIGN_NULL = 0, PG_ALIGN_NONE, PG_ALIGN_NEGATIVE, PG_ALIGN_CENTER,
    PG_ALIGN_POSITIVE, PG_ALIGN_INWARD_HORIZONTAL, PG_ALIGN_INWARD_VERTICAL
} pg_alignment;
typedef enum pg_axis_overlap {
    PG_OVERLAP_NULL = 18, PG_OVERLAP_ALLOWED, PG_OVERLAP_PREVENTED,
    PG_OVERLAP_DEFAULT
} pg_axis_overlap;
typedef enum pg_preferred_axis {
    PG_PREFERRED_NULL = 0, PG_PREFERRED_PARENT, PG_PREFERRED_PERPENDICULAR,
    PG_PREFERRED_HORIZONTAL, PG_PREFERRED_VERTICAL
} pg_preferred_axis;
typedef enum pg_layout_phase {
    PG_LAYOUT_NULL = 0, PG_LAYOUT_NEEDS_COMMIT, PG_LAYOUT_COMMITTED,
    PG_LAYOUT_IN_COMMIT
} pg_layout_phase;

/* Iteration order matches forEachDirection/forEachCardinalDirection. */
extern const pg_direction pg_directions[PG_NUM_DIRECTIONS];
extern const pg_direction pg_cardinal_directions[PG_NUM_CARDINAL_DIRECTIONS];

/* Invalid values return NULL for names, a NONE/NULL enum for conversions,
 * false for predicates, and zero for sign. Inputs are never used as unchecked
 * array indexes. Direction strings match by first letter, as in TypeScript;
 * other readers accept the documented TypeScript aliases, case-insensitively.
 * No reader allocates memory; a NULL string is an unrecognized value. */
bool pg_direction_valid(pg_direction direction);
bool pg_axis_valid(pg_axis axis);
pg_direction pg_direction_read(const char *text);
const char *pg_direction_name(pg_direction direction);
const char *pg_axis_name(pg_axis axis);
pg_direction pg_direction_reverse(pg_direction direction);
pg_axis pg_direction_axis(pg_direction direction);
pg_axis pg_direction_perpendicular_axis(int axis_or_direction);
pg_direction pg_direction_positive(pg_axis axis);
pg_direction pg_direction_negative(pg_axis axis);
bool pg_direction_is_cardinal(pg_direction direction);
bool pg_direction_is_vertical(pg_direction direction);
bool pg_direction_is_horizontal(pg_direction direction);
bool pg_direction_is_positive(pg_direction direction);
bool pg_direction_is_negative(pg_direction direction);
int pg_direction_sign(pg_direction direction);
pg_direction pg_direction_alternate(pg_direction direction);
pg_direction pg_direction_turn_left(pg_direction direction);
pg_direction pg_direction_turn_right(pg_direction direction);
pg_direction pg_direction_turn_positive(pg_direction direction);
pg_direction pg_direction_turn_negative(pg_direction direction);

pg_fit pg_fit_read(const char *text);
const char *pg_fit_name(pg_fit fit);
pg_alignment pg_alignment_read(const char *text);
const char *pg_alignment_name(pg_alignment alignment);
pg_axis_overlap pg_axis_overlap_read(const char *text);
const char *pg_axis_overlap_name(pg_axis_overlap overlap);
pg_preferred_axis pg_preferred_axis_read(const char *text);
const char *pg_preferred_axis_name(pg_preferred_axis preference);
const char *pg_layout_phase_name(pg_layout_phase phase);

#ifdef __cplusplus
}
#endif
#endif
