#include <parsegraph/caret.h>
#include <parsegraph/layout.h>
#include <parsegraph/paint.h>
#include <stdlib.h>

/* Checks deliberately remain active in Release builds. */
static void check(int condition) { if (!condition) abort(); }

int main(void) {
    pg_node *root = pg_node_new(NULL);
    check(root != NULL);
    pg_caret *caret = pg_caret_new(root);
    check(caret != NULL);
    pg_node *child = NULL;
    check(pg_caret_spawn(caret, PG_FORWARD, NULL, PG_ALIGN_CENTER, &child) == PG_OK);
    check(pg_node_set_size(root, 20, 12) == PG_OK);
    check(pg_node_set_size(child, 10, 10) == PG_OK);
    check(pg_node_crease(child) == PG_OK);
    pg_layout *layout = pg_layout_new(root, NULL);
    check(layout != NULL);
    check(pg_layout_run(layout) == PG_OK);
    pg_transform transform;
    check(pg_node_absolute_transform(child, &transform) == PG_OK);
    check(transform.x == 15 && transform.y == 0 && transform.scale == 1);
    pg_rect bounds;
    check(pg_paint_group_bounds(root, 0.5, &bounds) == PG_OK);
    check(bounds.width >= 20 && bounds.height >= 12);
    pg_layout_free(layout);
    pg_caret_free(caret);
    pg_node_free_tree(root);
    return 0;
}
