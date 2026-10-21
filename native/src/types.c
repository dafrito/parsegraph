#include "parsegraph/types.h"

const pg_direction pg_directions[PG_NUM_DIRECTIONS] = {
    PG_DOWNWARD, PG_UPWARD, PG_FORWARD, PG_BACKWARD, PG_INWARD, PG_OUTWARD
};
const pg_direction pg_cardinal_directions[PG_NUM_CARDINAL_DIRECTIONS] = {
    PG_DOWNWARD, PG_UPWARD, PG_FORWARD, PG_BACKWARD
};

/* ASCII matching is locale-independent and never passes a negative char to
 * ctype. The public spellings and aliases are exclusively ASCII. */
static char lower_ascii(char c) { return c >= 'A' && c <= 'Z' ? (char)(c + 32) : c; }
static bool matches(const char *a, const char *b) {
    if (!a) return false;
    while (*a && *b) {
        if (lower_ascii(*a++) != *b++) return false;
    }
    return *a == *b;
}

bool pg_direction_valid(pg_direction d) { return d >= PG_INWARD && d <= PG_BACKWARD; }
bool pg_axis_valid(pg_axis a) { return a >= PG_HORIZONTAL && a <= PG_Z; }
pg_direction pg_direction_read(const char *text) {
    if (!text) return PG_DIRECTION_NONE;
    switch (lower_ascii(text[0])) {
        case 'i': return PG_INWARD;
        case 'o': return PG_OUTWARD;
        case 'd': return PG_DOWNWARD;
        case 'u': return PG_UPWARD;
        case 'f': return PG_FORWARD;
        case 'b': return PG_BACKWARD;
        default: return PG_DIRECTION_NONE;
    }
}
const char *pg_direction_name(pg_direction d) {
    static const char *const names[] = {"INWARD", "OUTWARD", "DOWNWARD", "UPWARD", "FORWARD", "BACKWARD"};
    return pg_direction_valid(d) ? names[d] : NULL;
}
const char *pg_axis_name(pg_axis a) {
    switch (a) {
        case PG_HORIZONTAL: return "HORIZONTAL";
        case PG_VERTICAL: return "VERTICAL";
        case PG_Z: return "Z";
        default: return NULL;
    }
}
pg_direction pg_direction_reverse(pg_direction d) {
    return pg_direction_valid(d) ? (pg_direction)((unsigned)d ^ 1u) : PG_DIRECTION_NONE;
}
pg_axis pg_direction_axis(pg_direction d) {
    switch (d) {
        case PG_INWARD: case PG_OUTWARD: return PG_Z;
        case PG_DOWNWARD: case PG_UPWARD: return PG_VERTICAL;
        case PG_FORWARD: case PG_BACKWARD: return PG_HORIZONTAL;
        default: return PG_AXIS_NONE;
    }
}
pg_axis pg_direction_perpendicular_axis(int value) {
    pg_axis a = pg_axis_valid((pg_axis)value) ? (pg_axis)value : pg_direction_axis((pg_direction)value);
    switch (a) {
        case PG_HORIZONTAL: return PG_VERTICAL;
        case PG_VERTICAL: return PG_HORIZONTAL;
        case PG_Z: return PG_Z;
        default: return PG_AXIS_NONE;
    }
}
pg_direction pg_direction_positive(pg_axis a) {
    switch (a) {
        case PG_HORIZONTAL: return PG_FORWARD;
        case PG_VERTICAL: return PG_DOWNWARD;
        case PG_Z: return PG_OUTWARD;
        default: return PG_DIRECTION_NONE;
    }
}
pg_direction pg_direction_negative(pg_axis a) { return pg_direction_reverse(pg_direction_positive(a)); }
bool pg_direction_is_cardinal(pg_direction d) { return d >= PG_DOWNWARD && d <= PG_BACKWARD; }
bool pg_direction_is_vertical(pg_direction d) { return d == PG_DOWNWARD || d == PG_UPWARD; }
bool pg_direction_is_horizontal(pg_direction d) { return d == PG_FORWARD || d == PG_BACKWARD; }
bool pg_direction_is_positive(pg_direction d) { return d == PG_DOWNWARD || d == PG_FORWARD || d == PG_OUTWARD; }
bool pg_direction_is_negative(pg_direction d) { return d == PG_UPWARD || d == PG_BACKWARD || d == PG_INWARD; }
int pg_direction_sign(pg_direction d) { return !pg_direction_valid(d) ? 0 : pg_direction_is_positive(d) ? 1 : -1; }
pg_direction pg_direction_alternate(pg_direction d) {
    switch (d) {
        case PG_DOWNWARD: case PG_INWARD: return PG_FORWARD;
        case PG_FORWARD: return PG_DOWNWARD;
        default: return PG_DIRECTION_NONE;
    }
}
pg_direction pg_direction_turn_left(pg_direction d) {
    switch (d) {
        case PG_FORWARD: return PG_UPWARD;
        case PG_BACKWARD: return PG_DOWNWARD;
        case PG_DOWNWARD: return PG_FORWARD;
        case PG_UPWARD: return PG_BACKWARD;
        default: return PG_DIRECTION_NONE;
    }
}
pg_direction pg_direction_turn_right(pg_direction d) { return pg_direction_reverse(pg_direction_turn_left(d)); }
pg_direction pg_direction_turn_positive(pg_direction d) {
    return pg_direction_valid(d) ? pg_direction_positive(pg_direction_perpendicular_axis(d)) : PG_DIRECTION_NONE;
}
pg_direction pg_direction_turn_negative(pg_direction d) { return pg_direction_reverse(pg_direction_turn_positive(d)); }

pg_fit pg_fit_read(const char *s) {
    if (matches(s,"e") || matches(s,"exact")) return PG_FIT_EXACT;
    if (matches(s,"l") || matches(s,"loose")) return PG_FIT_LOOSE;
    if (matches(s,"n") || matches(s,"naive")) return PG_FIT_NAIVE;
    return PG_FIT_NULL;
}
const char *pg_fit_name(pg_fit f) {
    switch (f) {
        case PG_FIT_NULL: return "NULL";
        case PG_FIT_EXACT: return "EXACT";
        case PG_FIT_LOOSE: return "LOOSE";
        case PG_FIT_NAIVE: return "NAIVE";
        default: return NULL;
    }
}
pg_alignment pg_alignment_read(const char *s) {
    if (matches(s,"none") || matches(s,"no")) return PG_ALIGN_NONE;
    if (matches(s,"negative") || matches(s,"neg") || matches(s,"n")) return PG_ALIGN_NEGATIVE;
    if (matches(s,"positive") || matches(s,"pos") || matches(s,"p")) return PG_ALIGN_POSITIVE;
    if (matches(s,"center") || matches(s,"c")) return PG_ALIGN_CENTER;
    if (matches(s,"vertical") || matches(s,"v")) return PG_ALIGN_INWARD_VERTICAL;
    if (matches(s,"horizontal") || matches(s,"h")) return PG_ALIGN_INWARD_HORIZONTAL;
    return PG_ALIGN_NULL;
}
const char *pg_alignment_name(pg_alignment a) {
    static const char *const names[] = {"NULL", "NONE", "NEGATIVE", "CENTER", "POSITIVE", "HORIZONTAL", "VERTICAL"};
    return a >= PG_ALIGN_NULL && a <= PG_ALIGN_INWARD_VERTICAL ? names[a] : NULL;
}
pg_axis_overlap pg_axis_overlap_read(const char *s) {
    if (matches(s,"a") || matches(s,"allow") || matches(s,"allowed")) return PG_OVERLAP_ALLOWED;
    if (matches(s,"p") || matches(s,"prevent") || matches(s,"prevented")) return PG_OVERLAP_PREVENTED;
    if (matches(s,"d") || matches(s,"def") || matches(s,"default") || matches(s,"defaulted")) return PG_OVERLAP_DEFAULT;
    return PG_OVERLAP_NULL;
}
const char *pg_axis_overlap_name(pg_axis_overlap a) {
    switch (a) {
        case PG_OVERLAP_NULL: return "NULL";
        case PG_OVERLAP_ALLOWED: return "ALLOWED";
        case PG_OVERLAP_PREVENTED: return "PREVENTED";
        case PG_OVERLAP_DEFAULT: return "DEFAULT";
        default: return NULL;
    }
}
pg_preferred_axis pg_preferred_axis_read(const char *s) {
    if (matches(s,"pa") || matches(s,"par") || matches(s,"parent")) return PG_PREFERRED_PARENT;
    if (matches(s,"pe") || matches(s,"perp") || matches(s,"perpendicular")) return PG_PREFERRED_PERPENDICULAR;
    if (matches(s,"v") || matches(s,"vert") || matches(s,"vertical")) return PG_PREFERRED_VERTICAL;
    if (matches(s,"h") || matches(s,"horz") || matches(s,"horizontal")) return PG_PREFERRED_HORIZONTAL;
    return PG_PREFERRED_NULL;
}
const char *pg_preferred_axis_name(pg_preferred_axis p) {
    static const char *const names[] = {"NULL", "PARENT", "PERPENDICULAR", "HORIZONTAL", "VERTICAL"};
    return p >= PG_PREFERRED_NULL && p <= PG_PREFERRED_VERTICAL ? names[p] : NULL;
}
const char *pg_layout_phase_name(pg_layout_phase p) {
    static const char *const names[] = {"NULL", "NEEDS_COMMIT", "COMMITTED", "IN_COMMIT"};
    return p >= PG_LAYOUT_NULL && p <= PG_LAYOUT_IN_COMMIT ? names[p] : NULL;
}
