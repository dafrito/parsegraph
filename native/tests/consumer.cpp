#include "parsegraph/extent.h"

int main() {
    pg_extent extent{};
    auto status = pg_extent_append(&extent, 10, 20);
    pg_bound bound{};
    bool ok = status == PG_OK && pg_extent_get(&extent, 0, &bound) == PG_OK && bound.size == 20;
    pg_extent_destroy(&extent);
    return ok ? 0 : 1;
}
