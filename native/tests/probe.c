/* Test-only line protocol; no JSON library or process I/O in the core. */
#include "parsegraph/extent.h"
#include <stdio.h>

int main(void) {
    size_t na, nb;
    double displacement, adjustment, scale;
    int overlap;
    while (scanf("%zu %zu %lf %lf %lf %d", &na, &nb, &displacement, &adjustment, &scale, &overlap) == 6) {
        pg_extent a = {0}, b = {0}, result = {0}, simplified = {0};
        for (size_t i = 0; i < na + nb; ++i) {
            double length, size;
            if (scanf("%lf %lf", &length, &size) != 2) return 2;
            if (pg_extent_append(i < na ? &a : &b, length, size) != PG_OK) return 3;
        }
        double separation, values[3];
        if (pg_extent_separation(&a, &b, displacement, overlap != 0, scale, &separation) != PG_OK ||
            pg_extent_combine(&result, &a, &b, displacement, adjustment, scale) != PG_OK ||
            pg_extent_combine_simplified(&simplified, &a, &b, displacement, adjustment, scale) != PG_OK) return 4;
        printf("%.17g %zu", separation, pg_extent_count(&result));
        for (size_t i = 0; i < pg_extent_count(&result); ++i) {
            pg_bound value;
            if (pg_extent_get(&result, i, &value) != PG_OK) return 5;
            printf(" %.17g %.17g", (double)value.length, (double)value.size);
        }
        pg_extent_bounding_values(&result, values);
        printf(" %.17g %.17g %.17g %zu", values[0], values[1], values[2], pg_extent_count(&simplified));
        if (pg_extent_count(&simplified)) {
            pg_bound value;
            if (pg_extent_get(&simplified, 0, &value) != PG_OK) return 6;
            printf(" %.17g %.17g", (double)value.length, (double)value.size);
        }
        puts("");
        pg_extent_destroy(&a); pg_extent_destroy(&b);
        pg_extent_destroy(&result); pg_extent_destroy(&simplified);
    }
    return feof(stdin) ? 0 : 7;
}
