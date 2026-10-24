#include <parsegraph/caret.h>
#include <parsegraph/layout.h>
#include <parsegraph/paint.h>
#include <cstdlib>
#include <memory>

static void check(bool condition) { if (!condition) std::abort(); }

int main() {
    std::unique_ptr<pg_node, decltype(&pg_node_free_tree)> root(pg_node_new(nullptr), pg_node_free_tree);
    check(bool(root));
    std::unique_ptr<pg_caret, decltype(&pg_caret_free)> caret(pg_caret_new(root.get()), pg_caret_free);
    check(bool(caret));
    pg_node *child = nullptr;
    check(pg_caret_spawn(caret.get(), PG_DOWNWARD, nullptr, PG_ALIGN_CENTER, &child) == PG_OK);
    check(pg_node_set_size(root.get(), 20, 12) == PG_OK);
    check(pg_node_set_size(child, 10, 10) == PG_OK);
    std::unique_ptr<pg_layout, decltype(&pg_layout_free)> layout(pg_layout_new(root.get(), nullptr), pg_layout_free);
    check(bool(layout));
    check(pg_layout_run(layout.get()) == PG_OK);
    pg_transform transform;
    check(pg_node_absolute_transform(child, &transform) == PG_OK);
    check(transform.x == 0 && transform.y == 11 && transform.scale == 1);
    pg_rect bounds;
    check(pg_paint_group_bounds(root.get(), 0.5, &bounds) == PG_OK);
    check(bounds.height >= 22);
}
