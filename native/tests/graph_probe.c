/* Test-only line protocol, deliberately independent of JSON/rendering packages. */
#include "parsegraph/layout.h"
#include "parsegraph/paint.h"
#include "../src/node_internal.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct sample { double width, height, spacing[6][2]; } sample;
static pg_status measure(pg_node *node, double size[2], void *ctx) {
    (void)ctx; sample *v = pg_node_value(node);
    size[0] = v->width; size[1] = v->height; return PG_OK;
}
static double separation(pg_node *node, pg_axis axis, pg_direction dir, bool vertical, void *ctx) {
    (void)axis; (void)ctx; sample *v = pg_node_value(node);
    return v->spacing[dir][vertical ? 1 : 0];
}
static void check(pg_status s) { if (s != PG_OK) { fprintf(stderr,"status %d\n",s); exit(2); } }
static void rectangle(double x,double y,double w,double h,void *ctx) {
    (void)ctx; printf(" %.17g %.17g %.17g %.17g",x,y,w,h);
}
static void snapshot(pg_node **nodes,size_t count,size_t budget) {
    pg_layout_painter p = {measure,separation,NULL};
    pg_layout_metrics totals = {0};
    for(size_t i=0;i<count;++i) if(!pg_node_parent(nodes[i])) {
        pg_layout *job = pg_layout_new(nodes[i],&p); if(!job) exit(3);
        bool done=false; size_t rounds=0;
        while(!done) { check(pg_layout_step(job,budget,&done)); if(++rounds>1000000) exit(4); }
        pg_layout_metrics m; pg_layout_get_metrics(job,&m);
        totals.nodes_committed+=m.nodes_committed; totals.nodes_measured+=m.nodes_measured;
        totals.work_units+=m.work_units; totals.clean_subtrees_skipped+=m.clean_subtrees_skipped;
        pg_layout_free(job);
    }
    printf("S %zu\n",count);
    for(size_t i=0;i<count;++i) {
        pg_node *n=nodes[i], *parent=pg_node_parent(n);
        pg_transform group, absolute; double size[2];
        check(pg_node_group_transform(n,&group)); check(pg_node_absolute_transform(n,&absolute));
        check(pg_node_size(n,size));
        printf("N %zu %lld %d %llu %d %.17g %.17g %.17g %.17g %.17g %.17g %.17g %.17g\n",i,
            parent?(long long)pg_node_id(parent):-1,pg_node_parent_direction(n),
            (unsigned long long)pg_node_id(pg_node_paint_group(n)),pg_node_canonical_preferred_axis(n),
            size[0],size[1],group.x,group.y,group.scale,absolute.x,absolute.y,absolute.scale);
        for(int d=PG_DOWNWARD;d<=PG_BACKWARD;++d) {
            const pg_extent *e=pg_node_extent(n,(pg_direction)d);
            printf("E %zu %d %.17g %zu",i,d,pg_extent_offset(e),pg_extent_count(e));
            for(size_t k=0;k<pg_extent_count(e);++k) {pg_bound b;check(pg_extent_get(e,k,&b));printf(" %.17g %.17g",(double)b.length,(double)b.size);}
            putchar('\n');
        }
        for(int d=0;d<6;++d) if(pg_node_child(n,(pg_direction)d)) {
            double pos[2];check(pg_node_child_position(n,(pg_direction)d,pos));
            printf("C %zu %d %llu %.17g %.17g %.17g %.17g %.17g\n",i,d,
                (unsigned long long)pg_node_id(pg_node_child(n,(pg_direction)d)),
                pg_node_alignment_offset(n,(pg_direction)d),n->edges[d].separation,
                pg_node_line_length(n,(pg_direction)d),pos[0],pos[1]);
        }
        printf("P %zu",i);check(pg_paint_node_bounds(n,rectangle,NULL));
        check(pg_paint_node_lines(n,0.5,rectangle,NULL));putchar('\n');
        printf("G %zu",i);pg_node *s=n;size_t guard=0;
        do {printf(" %llu",(unsigned long long)pg_node_id(s));s=pg_node_sibling_next(s);if(++guard>count) exit(5);} while(s!=n);
        putchar('\n');
    }
    for(size_t i=0;i<count;++i) if(pg_node_is_paint_group(nodes[i])) {
        pg_rect r;check(pg_paint_group_bounds(nodes[i],0.5,&r));
        printf("R %zu %.17g %.17g %.17g %.17g\n",i,r.x,r.y,r.width,r.height);
    }
    printf("M %llu %llu %llu %llu\n",(unsigned long long)totals.nodes_committed,
        (unsigned long long)totals.nodes_measured,(unsigned long long)totals.work_units,
        (unsigned long long)totals.clean_subtrees_skipped);
}
int main(void) {
    char command[32];pg_node **nodes=NULL;sample *values=NULL;size_t count=0;
    while(scanf("%31s",command)==1) {
        size_t i;int d;
        if(!strcmp(command,"new")) {
            if(nodes || scanf("%zu",&count)!=1 || count>100000) return 1;
            nodes=calloc(count,sizeof(*nodes));values=calloc(count,sizeof(*values));
            if(!nodes || !values) return 3;
            for(i=0;i<count;++i) {nodes[i]=pg_node_new(&values[i]);if(!nodes[i]) return 3;pg_node_set_id(nodes[i],i);}
        } else if(!strcmp(command,"set")) {
            double w,h,scale;int fit,pref,rtl,creased;
            if(scanf("%zu %lf %lf %lf %d %d %d %d",&i,&w,&h,&scale,&fit,&pref,&rtl,&creased)!=8 || i>=count) return 1;
            if(values[i].width!=w || values[i].height!=h) {values[i].width=w;values[i].height=h;pg_node_invalidate(nodes[i]);}
            check(pg_node_set_scale(nodes[i],scale));check(pg_node_set_fit(nodes[i],(pg_fit)fit));
            if(pg_node_preferred_axis(nodes[i])!=(pg_preferred_axis)pref) check(pg_node_set_preferred_axis(nodes[i],(pg_preferred_axis)pref));
            check(pg_node_set_right_to_left(nodes[i],rtl!=0));
            if(creased) check(pg_node_crease(nodes[i]));else check(pg_node_uncrease(nodes[i]));
        } else if(!strcmp(command,"config")) {
            int a,o;double s0,s1;
            if(scanf("%zu %d %d %d %lf %lf",&i,&d,&a,&o,&s0,&s1)!=6 || i>=count || d<0 || d>=6) return 1;
            check(pg_node_set_alignment(nodes[i],(pg_direction)d,(pg_alignment)a));
            check(pg_node_set_overlap(nodes[i],(pg_direction)d,(pg_axis_overlap)o));
            if(values[i].spacing[d][0]!=s0 || values[i].spacing[d][1]!=s1) pg_node_invalidate(nodes[i]);
            values[i].spacing[d][0]=s0;values[i].spacing[d][1]=s1;
        } else if(!strcmp(command,"connect")) {
            size_t child;if(scanf("%zu %d %zu",&i,&d,&child)!=3 || i>=count || child>=count) return 1;
            check(pg_node_connect(nodes[i],(pg_direction)d,nodes[child]));
        } else if(!strcmp(command,"disconnect")) {
            if(scanf("%zu %d",&i,&d)!=2 || i>=count) return 1;
            pg_node_disconnect(nodes[i],(pg_direction)d);
        } else if(!strcmp(command,"snapshot")) {
            size_t budget;if(scanf("%zu",&budget)!=1 || !budget) return 1;snapshot(nodes,count,budget);
        } else if(!strcmp(command,"end")) {
            for(i=0;i<count;++i) pg_node_free(nodes[i]);free(nodes);free(values);nodes=NULL;values=NULL;count=0;
        } else return 1;
    }
    return nodes?1:0;
}
