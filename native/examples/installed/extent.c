#include <parsegraph/extent.h>

int main(void) {
    pg_extent extent = {0};
    pg_bound bound = {0};
    int ok = pg_extent_append(&extent, 10, 20) == PG_OK
        && pg_extent_get(&extent, 0, &bound) == PG_OK
        && bound.length == 10 && bound.size == 20;
    pg_extent_destroy(&extent);
    return ok ? 0 : 1;
}
