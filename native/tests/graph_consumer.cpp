#include "parsegraph/caret.h"
#include "parsegraph/layout.h"
#include "parsegraph/paint.h"
#include <memory>
#include <cmath>
#include <cstdlib>
static void check(bool value){if(!value)std::abort();}
static void rectangle(double x,double y,double w,double h,void *ctx){check(std::isfinite(x)&&std::isfinite(y)&&w>=0&&h>=0);++*static_cast<int*>(ctx);}
int main(){
    std::unique_ptr<pg_node,decltype(&pg_node_free_tree)> graph(pg_node_new(nullptr),pg_node_free_tree);check(bool(graph));
    std::unique_ptr<pg_caret,decltype(&pg_caret_free)> caret(pg_caret_new(graph.get()),pg_caret_free);check(bool(caret));
    pg_node *child=nullptr;check(pg_caret_spawn(caret.get(),PG_FORWARD,nullptr,PG_ALIGN_CENTER,&child)==PG_OK);
    check(pg_node_set_size(graph.get(),20,12)==PG_OK);check(pg_node_set_size(child,10,10)==PG_OK);check(pg_node_crease(child)==PG_OK);
    std::unique_ptr<pg_layout,decltype(&pg_layout_free)> layout(pg_layout_new(graph.get(),nullptr),pg_layout_free);check(bool(layout));check(pg_layout_run(layout.get())==PG_OK);
    pg_transform t;check(pg_node_absolute_transform(child,&t)==PG_OK);check(t.x==15&&t.y==0&&t.scale==1);
    int calls=0;check(pg_paint_node_bounds(graph.get(),rectangle,&calls)==PG_OK);check(pg_paint_node_lines(graph.get(),.5,rectangle,&calls)==PG_OK);check(calls==2);
    pg_rect bounds;check(pg_paint_group_bounds(graph.get(),.5,&bounds)==PG_OK);check(bounds.width>=20&&bounds.height>=12);
}
