/* A renderer written against only public headers. stdout is a complete SVG. */
#include "parsegraph/caret.h"
#include "parsegraph/layout.h"
#include "parsegraph/paint.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static void require_ok(pg_status s) { if(s!=PG_OK){fprintf(stderr,"parsegraph status %d\n",s);exit(1);} }
static pg_status measure(pg_node *node,double size[2],void *ctx) {
    (void)ctx; const char *label=pg_node_value(node);
    size[0]=label?fmax(24,strlen(label)*7+12):12;size[1]=label?24:12;return PG_OK;
}
static double gap(pg_node *node,pg_axis axis,pg_direction direction,bool vertical,void *ctx) {
    (void)node;(void)axis;(void)direction;(void)vertical;(void)ctx;return 12;
}
typedef struct scene {pg_transform transform;double left,top,right,bottom;bool emit;const char *fill;} scene;
static void rect(double x,double y,double w,double h,void *ctx) {
    scene *s=ctx;x=s->transform.x+x*s->transform.scale;y=s->transform.y+y*s->transform.scale;
    w*=s->transform.scale;h*=s->transform.scale;
    s->left=fmin(s->left,x-w/2);s->top=fmin(s->top,y-h/2);
    s->right=fmax(s->right,x+w/2);s->bottom=fmax(s->bottom,y+h/2);
    if(s->emit)printf("<rect x=\"%.8g\" y=\"%.8g\" width=\"%.8g\" height=\"%.8g\" fill=\"%s\"/>\n",x-w/2,y-h/2,w,h,s->fill);
}
static void escaped(const char *s){for(;*s;++s)switch(*s){case '&':fputs("&amp;",stdout);break;case '<':fputs("&lt;",stdout);break;case '>':fputs("&gt;",stdout);break;default:putchar(*s);}}
static void draw(pg_node *root,scene *s) {
    for(pg_node *n=root;n;n=pg_node_next_preorder(n,root)) {
        require_ok(pg_node_absolute_transform(pg_node_paint_group(n),&s->transform));
        s->fill="#64748b";require_ok(pg_paint_node_lines(n,1,rect,s));
        s->fill=pg_node_is_paint_group(n)?"#a5b4fc":"#d9f99d";require_ok(pg_paint_node_bounds(n,rect,s));
        const char *label=pg_node_value(n);
        if(s->emit&&label){pg_transform t;require_ok(pg_node_absolute_transform(n,&t));printf("<text x=\"%.8g\" y=\"%.8g\" font-size=\"%.8g\" text-anchor=\"middle\" dominant-baseline=\"central\">",t.x,t.y,10*t.scale);escaped(label);puts("</text>");}
    }
}
int main(void) {
    pg_node *root=pg_node_new("Parsegraph C");if(!root)return 1;
    pg_caret *caret=pg_caret_new(root);if(!caret){pg_node_free(root);return 1;}
    static char labels[8][24];
    for(int i=0;i<8;++i){pg_node *column;snprintf(labels[i],sizeof(labels[i]),"group %d",i+1);
        require_ok(pg_caret_spawn_move(caret,PG_FORWARD,labels[i],PG_ALIGN_NONE,&column));
        require_ok(pg_node_crease(column));require_ok(pg_node_set_scale(column,.95));
        require_ok(pg_caret_push(caret));
        for(int j=0;j<=i;++j){pg_node *child;require_ok(pg_caret_spawn_move(caret,PG_DOWNWARD,NULL,PG_ALIGN_NONE,&child));}
        require_ok(pg_caret_pop(caret));}
    pg_layout_painter painter={measure,gap,NULL};pg_layout *layout=pg_layout_new(root,&painter);
    if(!layout){pg_caret_free(caret);pg_node_free_tree(root);return 1;}require_ok(pg_layout_run(layout));
    scene s={{0,0,1},INFINITY,INFINITY,-INFINITY,-INFINITY,false,NULL};draw(root,&s);
    printf("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"%.8g %.8g %.8g %.8g\" width=\"1200\">\n",s.left-16,s.top-16,s.right-s.left+32,s.bottom-s.top+32);
    puts("<title>Native Parsegraph: eight paint groups</title><g font-family=\"sans-serif\">");s.emit=true;draw(root,&s);puts("</g></svg>");
    pg_layout_free(layout);pg_caret_free(caret);pg_node_free_tree(root);return 0;
}
