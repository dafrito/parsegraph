/* Shared-fixture headless worker. JSONL stdout, diagnostics stderr. */
#define _POSIX_C_SOURCE 200809L
#ifdef __APPLE__
#define _DARWIN_C_SOURCE 1
#endif
#include "parsegraph/layout.h"
#include "../src/node_internal.h"
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/resource.h>
#include <time.h>

typedef struct record { int parent, direction, crease, preferred, alignment, overlap; double width, height, scale; } record;
typedef struct body { double width, height; } body;
typedef struct graph { size_t count; pg_node **nodes; body *bodies; pg_layout *layout; } graph;
static void require(int yes, const char *message) {
    if (!yes) { fprintf(stderr, "matched benchmark: %s\n", message); exit(1); }
}
static void check(pg_status status) { require(status == PG_OK, "library operation failed"); }
static double now(void) {
    struct timespec t;
    require(clock_gettime(CLOCK_MONOTONIC, &t) == 0, "monotonic clock failed");
    return (double)t.tv_sec * 1000 + (double)t.tv_nsec / 1000000;
}
static pg_status measure(pg_node *node, double out[2], void *context) {
    (void)context;
    body *b = pg_node_value(node); out[0] = b->width; out[1] = b->height;
    return PG_OK;
}
static double gap(pg_node *node, pg_axis axis, pg_direction direction, bool vertical, void *context) {
    (void)node; (void)axis; (void)direction; (void)vertical; (void)context; return 4;
}
static void output(graph *g, const char *stage, const char *part, double ms, size_t iterations, double checksum, bool emit) {
    if (!emit) return;
    size_t bounds = 0, capacity = 0;
    for (size_t i = 0; i < g->count; i++) for (size_t d = 0; d < 4; d++) {
        bounds += g->nodes[i]->extents[d].count;
        capacity += g->nodes[i]->extents[d].capacity * sizeof(pg_bound);
    }
    struct rusage usage;
    require(getrusage(RUSAGE_SELF, &usage) == 0, "getrusage failed");
#ifdef __APPLE__
    size_t peak = (size_t)usage.ru_maxrss;
#else
    size_t peak = (size_t)usage.ru_maxrss * 1024;
#endif
    pg_layout_metrics metrics; pg_layout_get_metrics(g->layout, &metrics);
    printf("{\"type\":\"sample\",\"stage\":\"%s%s%s\",\"elapsed_ms\":%.9g,\"iterations\":%zu,"
        "\"nodes_measured\":%llu,\"work_units\":%llu,\"checksum\":%.17g,\"memory\":{"
        "\"extent_bounds\":%zu,\"extent_capacity_bytes\":%zu,\"node_struct_bytes\":%zu,"
        "\"fixture_body_and_index_bytes\":%zu,\"rss_bytes\":null,\"peak_rss_bytes\":%zu,"
        "\"heap_used_bytes\":null,\"external_bytes\":null,\"array_buffer_bytes\":null}}\n",
        stage, part ? "/" : "", part ? part : "", ms, iterations,
        (unsigned long long)metrics.nodes_measured, (unsigned long long)metrics.work_units,
        checksum, bounds, capacity, sizeof(pg_node) * g->count,
        (sizeof(body) + sizeof(pg_node *)) * g->count, peak);
}
static double transforms(graph *g) {
    double sum = 0;
    for (size_t i = 0; i < g->count; i++) {
        pg_transform local, absolute;
        check(pg_node_group_transform(g->nodes[i], &local));
        check(pg_node_absolute_transform(g->nodes[i], &absolute));
        sum += local.x + local.y + local.scale + absolute.x + absolute.y + absolute.scale;
    }
    require(isfinite(sum), "nonfinite geometry"); return sum;
}
static void snapshot(graph *g, const char *stage) {
    printf("{\"type\":\"geometry\",\"stage\":\"%s\",\"nodes\":[", stage);
    for (size_t i = 0; i < g->count; i++) {
        pg_transform a, b; double size[2];
        check(pg_node_absolute_transform(g->nodes[i], &a));
        check(pg_node_group_transform(g->nodes[i], &b));
        check(pg_node_size(g->nodes[i], size));
        printf("%s[%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g,%.17g", i ? "," : "",
            a.x, a.y, a.scale, b.x, b.y, b.scale, size[0], size[1]);
        for (size_t d = 0; d < 4; d++) printf(",%.17g,%zu", g->nodes[i]->extents[d].offset, g->nodes[i]->extents[d].count);
        printf("]");
    }
    printf("]}\n");
}
static void run(graph *g, const char *stage, size_t iterations, int mutation, pg_node *group, bool emit, bool verify) {
    double api = 0, placement = 0, checksum = 0;
    pg_layout_clear_metrics(g->layout);
    for (size_t i = 0; i < iterations; i++) {
        double t = now();
        if (mutation == 1) { g->bodies[g->count - 1].height++; pg_node_invalidate(g->nodes[g->count - 1]); }
        if (mutation == 2) { g->bodies[0].height += 1000; pg_node_invalidate(g->nodes[0]); }
        if (mutation == 3) check(pg_node_set_scale(group, i % 2 ? .5 : .75));
        check(pg_layout_run(g->layout)); api += now() - t;
        t = now(); checksum = transforms(g); placement += now() - t;
    }
    output(g, stage, "api", api, iterations, checksum, emit);
    output(g, stage, "placement", placement, iterations, checksum, emit);
    output(g, stage, "ready", api + placement, iterations, checksum, emit);
    if (emit && verify) snapshot(g, stage);
}
static void trial(const record *records, size_t count, pg_fit fit, bool emit, bool verify) {
    double t = now();
    graph g = {count, calloc(count, sizeof(pg_node *)), calloc(count, sizeof(body)), NULL};
    require(g.nodes && g.bodies, "allocation failed");
    for (size_t i = 0; i < count; i++) {
        g.bodies[i] = (body){records[i].width, records[i].height};
        g.nodes[i] = pg_node_new(&g.bodies[i]); require(g.nodes[i] != NULL, "node allocation failed");
    }
    for (size_t i = 1; i < count; i++) check(pg_node_connect(g.nodes[records[i].parent], (pg_direction)records[i].direction, g.nodes[i]));
    for (size_t i = 0; i < count; i++) {
        check(pg_node_set_fit(g.nodes[i], fit));
        check(pg_node_set_scale(g.nodes[i], records[i].scale));
        check(pg_node_set_preferred_axis(g.nodes[i], (pg_preferred_axis)records[i].preferred));
        if (records[i].crease) check(pg_node_crease(g.nodes[i]));
        if (i) {
            check(pg_node_set_alignment(g.nodes[records[i].parent], (pg_direction)records[i].direction, (pg_alignment)records[i].alignment));
            check(pg_node_set_overlap(g.nodes[records[i].parent], (pg_direction)records[i].direction, (pg_axis_overlap)records[i].overlap));
        }
    }
    const pg_layout_painter painter = {measure, gap, NULL};
    g.layout = pg_layout_new(g.nodes[0], &painter); require(g.layout != NULL, "layout allocation failed");
    output(&g, "construct", NULL, now() - t, 1, 0, emit);
    run(&g, "full_layout", 1, 0, NULL, emit, verify);
    run(&g, "noop", 20, 0, NULL, emit, verify);
    run(&g, "leaf_resize", 3, 1, NULL, emit, verify);
    run(&g, "root_resize", 3, 2, NULL, emit, verify);
    pg_node *group = NULL;
    for (size_t i = 1; i < count; i++) if (pg_node_is_paint_group(g.nodes[i])) { group = g.nodes[i]; break; }
    if (group) run(&g, "group_scale", 4, 3, group, emit, verify);
    pg_layout_free(g.layout); pg_node_free_tree(g.nodes[0]); free(g.nodes); free(g.bodies);
}
int main(int argc, char **argv) {
    require(argc == 5, "usage: matched FIXTURE exact|loose WARMUPS measure|verify");
    require(!strcmp(argv[2], "exact") || !strcmp(argv[2], "loose"), "invalid fit");
    char *end; long warmups = strtol(argv[3], &end, 10);
    require(*argv[3] && !*end && warmups >= 0 && warmups <= 10, "invalid warmups");
    FILE *f = fopen(argv[1], "r"); require(f != NULL, "cannot open fixture");
    size_t count; require(fscanf(f, "%zu", &count) == 1 && count > 0 && count <= 4096, "invalid node count");
    record *records = calloc(count, sizeof(record)); require(records != NULL, "fixture allocation failed");
    for (size_t i = 0; i < count; i++) {
        record *r = &records[i];
        require(fscanf(f, "%d %d %lf %lf %lf %d %d %d %d", &r->parent, &r->direction,
            &r->width, &r->height, &r->scale, &r->crease, &r->preferred, &r->alignment, &r->overlap) == 9, "invalid record");
        require(i ? r->parent >= 0 && (size_t)r->parent < i : r->parent == -1, "invalid parent");
        require(isfinite(r->width) && r->width >= 0 && isfinite(r->height) && r->height >= 0
            && isfinite(r->scale) && r->scale > 0, "invalid size/scale");
    }
    char extra; require(fscanf(f, " %c", &extra) == EOF, "trailing input"); fclose(f);
    pg_fit fit = !strcmp(argv[2], "exact") ? PG_FIT_EXACT : PG_FIT_LOOSE;
    for (long i = 0; i < warmups; i++) trial(records, count, fit, false, false);
    trial(records, count, fit, true, !strcmp(argv[4], "verify")); free(records); return 0;
}
