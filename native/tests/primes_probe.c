/* JSON-lines topology + geometry oracle for the TypeScript parity script.
 * IDs/text are generated decimal identifiers, so need no JSON escaping. */
#include "primes.h"
#include "parsegraph/layout.h"

#include <stdio.h>
#include <stdlib.h>

static pg_status measure(pg_node *node, double size[2], void *context) {
    (void)node;
    size[0] = size[1] = pg_primes_cell_side(context);
    return PG_OK;
}
static void check(pg_status status) { if (status != PG_OK) exit(1); }
int main(int argc, char **argv) {
    if (argc != 2) return 2;
    pg_primes *p = pg_primes_new(atoi(argv[1]));
    if (!p) return 2;
    check(pg_primes_append(p, atoi(argv[1])));
    pg_layout_painter painter = {measure, NULL, p};
    pg_layout *layout = pg_layout_new(pg_primes_root(p), &painter);
    if (!layout) return 1;
    check(pg_layout_run(layout));
    for (size_t i = 0; i < pg_primes_node_count(p); ++i) {
        const pg_primes_record *record = pg_primes_record_at(p, i);
        const pg_primes_record *parent = pg_node_value(pg_node_parent(record->node));
        const pg_primes_record *group = pg_node_value(pg_node_paint_group(record->node));
        pg_transform world, local;
        check(pg_node_absolute_transform(record->node, &world));
        check(pg_node_group_transform(record->node, &local));
        printf("[\"%s\",\"%s\",\"%s\",%d,\"%s\",%d,%d,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g]\n",
               record->id, record->text, parent ? parent->id : "", pg_node_parent_direction(record->node),
               group->id, pg_node_canonical_preferred_axis(record->node), pg_node_is_creased(record->node),
               local.x, local.y, local.scale, world.x, world.y, world.scale);
    }
    pg_layout_free(layout); pg_primes_free(p);
    return 0;
}
