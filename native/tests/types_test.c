#include "parsegraph/types.h"
#include <assert.h>
#include <limits.h>
#include <stdio.h>
#include <string.h>

static void directions(void) {
    const pg_direction reverse[] = {PG_OUTWARD, PG_INWARD, PG_UPWARD, PG_DOWNWARD, PG_BACKWARD, PG_FORWARD};
    const pg_axis axis[] = {PG_Z, PG_Z, PG_VERTICAL, PG_VERTICAL, PG_HORIZONTAL, PG_HORIZONTAL};
    const int signs[] = {-1, 1, 1, -1, 1, -1};
    for (int d = 0; d < PG_NUM_DIRECTIONS; ++d) {
        pg_direction dir = (pg_direction)d;
        assert(pg_direction_valid(dir));
        assert(pg_direction_read(pg_direction_name(dir)) == dir);
        assert(pg_direction_reverse(dir) == reverse[d]);
        assert(pg_direction_reverse(pg_direction_reverse(dir)) == dir);
        assert(pg_direction_axis(dir) == axis[d]);
        assert(pg_direction_sign(dir) == signs[d]);
        assert(pg_direction_is_positive(dir) == (signs[d] == 1));
        assert(pg_direction_is_negative(dir) == (signs[d] == -1));
        assert(pg_direction_is_cardinal(dir) == (d >= 2));
        assert(pg_direction_is_vertical(dir) == (axis[d] == PG_VERTICAL));
        assert(pg_direction_is_horizontal(dir) == (axis[d] == PG_HORIZONTAL));
        assert(pg_direction_turn_negative(dir) == pg_direction_reverse(pg_direction_turn_positive(dir)));
    }
    for (int a = PG_HORIZONTAL; a <= PG_Z; ++a) {
        assert(pg_axis_valid((pg_axis)a));
        assert(pg_axis_name((pg_axis)a));
        assert(pg_direction_axis(pg_direction_positive((pg_axis)a)) == (pg_axis)a);
        assert(pg_direction_sign(pg_direction_positive((pg_axis)a)) == 1);
        assert(pg_direction_sign(pg_direction_negative((pg_axis)a)) == -1);
    }
    const pg_direction left[] = {PG_FORWARD, PG_BACKWARD, PG_UPWARD, PG_DOWNWARD};
    for (size_t i = 0; i < PG_NUM_CARDINAL_DIRECTIONS; ++i) {
        pg_direction d = pg_cardinal_directions[i];
        assert(pg_directions[i] == d);
        assert(pg_direction_turn_left(d) == left[i]);
        assert(pg_direction_turn_right(pg_direction_turn_left(d)) == d);
        assert(pg_direction_turn_left(pg_direction_turn_right(d)) == d);
        pg_direction turned = d;
        for (int j = 0; j < 4; ++j) turned = pg_direction_turn_left(turned);
        assert(turned == d);
    }
    assert(pg_directions[4] == PG_INWARD && pg_directions[5] == PG_OUTWARD);
    assert(pg_direction_perpendicular_axis(PG_Z) == PG_Z);
    assert(pg_direction_perpendicular_axis(PG_FORWARD) == PG_VERTICAL);
    assert(pg_direction_perpendicular_axis(PG_HORIZONTAL) == PG_VERTICAL);
    assert(pg_direction_perpendicular_axis(PG_UPWARD) == PG_HORIZONTAL);
    assert(pg_direction_turn_positive(PG_INWARD) == PG_OUTWARD);
    assert(pg_direction_alternate(PG_INWARD) == PG_FORWARD);
    assert(pg_direction_alternate(PG_DOWNWARD) == PG_FORWARD);
    assert(pg_direction_alternate(PG_FORWARD) == PG_DOWNWARD);
    assert(pg_direction_alternate(PG_UPWARD) == PG_DIRECTION_NONE);
    assert(pg_direction_turn_left(PG_INWARD) == PG_DIRECTION_NONE);
    assert(pg_direction_turn_right(PG_OUTWARD) == PG_DIRECTION_NONE);
    assert(pg_direction_read("fancy") == PG_FORWARD); /* TypeScript first-letter contract. */
    assert(pg_direction_read(NULL) == PG_DIRECTION_NONE);
    assert(pg_direction_read("") == PG_DIRECTION_NONE);
    assert(pg_direction_read("?") == PG_DIRECTION_NONE);
    assert(pg_direction_read("\xff") == PG_DIRECTION_NONE);

    const int invalid[] = {-1000, -1, 9, INT_MAX, INT_MIN};
    for (size_t i = 0; i < sizeof invalid / sizeof *invalid; ++i) {
        pg_direction d = (pg_direction)invalid[i];
        assert(!pg_direction_valid(d));
        assert(!pg_axis_valid((pg_axis)d));
        assert(!pg_direction_name(d));
        assert(!pg_axis_name((pg_axis)d));
        assert(pg_direction_reverse(d) == PG_DIRECTION_NONE);
        assert(pg_direction_axis(d) == PG_AXIS_NONE);
        assert(pg_direction_perpendicular_axis(d) == PG_AXIS_NONE);
        assert(pg_direction_positive((pg_axis)d) == PG_DIRECTION_NONE);
        assert(pg_direction_negative((pg_axis)d) == PG_DIRECTION_NONE);
        assert(pg_direction_sign(d) == 0);
        assert(!pg_direction_is_cardinal(d));
        assert(!pg_direction_is_positive(d));
        assert(!pg_direction_is_negative(d));
        assert(pg_direction_turn_positive(d) == PG_DIRECTION_NONE);
    }
}

static void enums(void) {
    assert(PG_FIT_NULL == 14 && PG_FIT_EXACT == 15 && PG_FIT_LOOSE == 16 && PG_FIT_NAIVE == 17);
    assert(PG_OVERLAP_NULL == 18 && PG_OVERLAP_ALLOWED == 19 && PG_OVERLAP_PREVENTED == 20 && PG_OVERLAP_DEFAULT == 21);
    assert(PG_ALIGN_NONE == 1 && PG_ALIGN_INWARD_VERTICAL == 6);
    assert(PG_PREFERRED_PARENT == 1 && PG_PREFERRED_VERTICAL == 4);
    assert(PG_LAYOUT_NEEDS_COMMIT == 1 && PG_LAYOUT_IN_COMMIT == 3);
    for (int f = PG_FIT_NULL; f <= PG_FIT_NAIVE; ++f) assert(pg_fit_read(pg_fit_name((pg_fit)f)) == (pg_fit)f);
    for (int a = PG_ALIGN_NULL; a <= PG_ALIGN_INWARD_VERTICAL; ++a) assert(pg_alignment_read(pg_alignment_name((pg_alignment)a)) == (pg_alignment)a);
    for (int a = PG_OVERLAP_NULL; a <= PG_OVERLAP_DEFAULT; ++a) assert(pg_axis_overlap_read(pg_axis_overlap_name((pg_axis_overlap)a)) == (pg_axis_overlap)a);
    for (int p = PG_PREFERRED_NULL; p <= PG_PREFERRED_VERTICAL; ++p) assert(pg_preferred_axis_read(pg_preferred_axis_name((pg_preferred_axis)p)) == (pg_preferred_axis)p);
    assert(pg_fit_read("E") == PG_FIT_EXACT && pg_fit_read("L") == PG_FIT_LOOSE && pg_fit_read("n") == PG_FIT_NAIVE);
    assert(pg_alignment_read("no") == PG_ALIGN_NONE && pg_alignment_read("NEG") == PG_ALIGN_NEGATIVE);
    assert(pg_alignment_read("n") == PG_ALIGN_NEGATIVE && pg_alignment_read("PoS") == PG_ALIGN_POSITIVE);
    assert(pg_alignment_read("p") == PG_ALIGN_POSITIVE && pg_alignment_read("c") == PG_ALIGN_CENTER);
    assert(pg_alignment_read("v") == PG_ALIGN_INWARD_VERTICAL && pg_alignment_read("h") == PG_ALIGN_INWARD_HORIZONTAL);
    assert(pg_axis_overlap_read("a") == PG_OVERLAP_ALLOWED && pg_axis_overlap_read("Allow") == PG_OVERLAP_ALLOWED);
    assert(pg_axis_overlap_read("p") == PG_OVERLAP_PREVENTED && pg_axis_overlap_read("prevent") == PG_OVERLAP_PREVENTED);
    assert(pg_axis_overlap_read("d") == PG_OVERLAP_DEFAULT && pg_axis_overlap_read("def") == PG_OVERLAP_DEFAULT && pg_axis_overlap_read("defaulted") == PG_OVERLAP_DEFAULT);
    assert(pg_preferred_axis_read("pa") == PG_PREFERRED_PARENT && pg_preferred_axis_read("par") == PG_PREFERRED_PARENT);
    assert(pg_preferred_axis_read("pe") == PG_PREFERRED_PERPENDICULAR && pg_preferred_axis_read("PERP") == PG_PREFERRED_PERPENDICULAR);
    assert(pg_preferred_axis_read("v") == PG_PREFERRED_VERTICAL && pg_preferred_axis_read("vert") == PG_PREFERRED_VERTICAL);
    assert(pg_preferred_axis_read("h") == PG_PREFERRED_HORIZONTAL && pg_preferred_axis_read("horz") == PG_PREFERRED_HORIZONTAL);
    assert(strcmp(pg_layout_phase_name(PG_LAYOUT_IN_COMMIT), "IN_COMMIT") == 0);
    assert(pg_fit_read(NULL) == PG_FIT_NULL && pg_fit_read("garbage") == PG_FIT_NULL);
    assert(pg_alignment_read(NULL) == PG_ALIGN_NULL && pg_alignment_read("garbage") == PG_ALIGN_NULL);
    assert(pg_axis_overlap_read(NULL) == PG_OVERLAP_NULL && pg_axis_overlap_read("garbage") == PG_OVERLAP_NULL);
    assert(pg_preferred_axis_read(NULL) == PG_PREFERRED_NULL && pg_preferred_axis_read("garbage") == PG_PREFERRED_NULL);
    assert(!pg_fit_name((pg_fit)-1) && !pg_alignment_name((pg_alignment)-1));
    assert(!pg_axis_overlap_name((pg_axis_overlap)-1) && !pg_preferred_axis_name((pg_preferred_axis)-1));
    assert(!pg_layout_phase_name((pg_layout_phase)-1));
}

int main(void) { directions(); enums(); puts("direction and enum tests passed"); return 0; }
