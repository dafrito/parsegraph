#include "parsegraph/caret.h"
#include "parsegraph/layout.h"
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include <string.h>
#define OK(x) assert((x)==PG_OK)
static double sizes[9][2]={{10,10},{10,100},{100,10},{10,10},{10,20},{100,10},{10,10},{10,50},{80,10}};
static pg_status measure(pg_node *n,double out[2],void *ctx) {
    (void)ctx;double *s=pg_node_value(n);out[0]=s[0];out[1]=s[1];return PG_OK;
}
int main(int argc,char **argv) {
    bool json=argc>1 && strcmp(argv[1],"--json")==0;
    assert(pg_caret_loosen(NULL)==PG_INVALID);
    assert(pg_node_set_separation_fit(NULL,PG_FORWARD,PG_FIT_LOOSE)==PG_INVALID);
    for(int opposing=0;opposing<2;++opposing) for(int pull=0;pull<2;++pull) {
        pg_node *n[9];int count=opposing?9:6;
        for(int i=0;i<count;++i) {n[i]=pg_node_new(sizes[i]);assert(n[i]);OK(pg_node_set_fit(n[i],PG_FIT_EXACT));}
        OK(pg_node_connect(n[0],PG_DOWNWARD,n[1]));OK(pg_node_connect(n[1],PG_FORWARD,n[2]));
        OK(pg_node_connect(n[0],PG_FORWARD,n[3]));OK(pg_node_connect(n[3],PG_DOWNWARD,n[4]));OK(pg_node_connect(n[4],PG_FORWARD,n[5]));
        if(opposing) {OK(pg_node_connect(n[0],PG_BACKWARD,n[6]));OK(pg_node_connect(n[6],PG_DOWNWARD,n[7]));OK(pg_node_connect(n[7],PG_BACKWARD,n[8]));OK(pg_node_set_scale(n[6],.5));}
        pg_caret *c=pg_caret_new(n[0]);assert(c);OK(pg_caret_pull(c,pull?PG_FORWARD:PG_DOWNWARD));
        pg_layout_painter painter={measure,NULL,NULL};pg_layout *l=pg_layout_new(n[0],&painter);assert(l);
        double original[9][2];double exact_x=0;
        for(int mode=0;mode<4;++mode) {
            if(mode==1) OK(pg_node_set_separation_fit(n[0],PG_FORWARD,PG_FIT_LOOSE));
            if(mode==2) OK(pg_caret_loosen(c));
            if(mode==3) {OK(pg_node_set_separation_fit(n[0],PG_FORWARD,PG_FIT_EXACT));OK(pg_caret_tighten(c));}
            OK(pg_layout_run(l));
            assert(pg_node_fit(n[0])==PG_FIT_EXACT);
            for(int i=0;i<count;++i) {
                pg_transform t;OK(pg_node_absolute_transform(n[i],&t));
                if(mode==0) {original[i][0]=t.x;original[i][1]=t.y;}
                if(mode==3) {assert(fabs(original[i][0]-t.x)<1e-6);assert(fabs(original[i][1]-t.y)<1e-6);}
                if(i==3) {
                    if(mode==0) exact_x=t.x;
                    if(mode==1 && !opposing) assert(pull ? t.x==exact_x : t.x>exact_x);
                }
                if(json) printf("{\"opposing\":%d,\"pull\":%d,\"mode\":%d,\"node\":%d,\"x\":%.17g,\"y\":%.17g}\n",opposing,pull,mode,i,t.x,t.y);
            }
            if(mode==1&&!pull) assert(pg_extent_count(pg_node_extent(n[0],PG_FORWARD))>1);
        }
        OK(pg_node_set_separation_fit(n[0],PG_BACKWARD,PG_FIT_LOOSE));
        assert(pg_node_set_separation_fit(n[0],PG_BACKWARD,PG_FIT_NAIVE)==PG_INVALID);
        assert(pg_node_separation_fit(n[0],PG_BACKWARD)==PG_FIT_LOOSE);
        assert(pg_node_set_separation_fit(n[0],PG_INWARD,PG_FIT_LOOSE)==PG_INVALID);
        assert(pg_node_separation_fit(n[0],PG_OUTWARD)==PG_FIT_NULL);
        pg_layout_free(l);pg_caret_free(c);pg_node_free_tree(n[0]);
    }
    return 0;
}
