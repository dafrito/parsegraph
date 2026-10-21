/* Reproducible workloads, not a pass/fail wall-clock performance test. */
#include "parsegraph/caret.h"
#include "parsegraph/layout.h"
#include "../src/node_internal.h" /* Diagnostic allocation/cache accounting. */

#include <errno.h>
#include <inttypes.h>
#include <math.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

typedef struct body { double width, height; } body;
typedef struct graph {
    pg_node **nodes;
    body *bodies;
    size_t count;
    pg_layout *layout;
} graph;
typedef struct memory_stats { size_t bounds, capacity_bytes, node_bytes; } memory_stats;
typedef struct cache_snapshot { double x, y, scale; uint64_t seen; } cache_snapshot;
static volatile double result_sink;

static void fail(const char *message) { fprintf(stderr, "benchmark: %s\n", message); exit(1); }
static void check(pg_status status) { if (status != PG_OK) fail("library operation failed"); }
static void require(bool condition, const char *message) { if (!condition) fail(message); }
static struct timespec start_time(void) {
    struct timespec result;
    if (timespec_get(&result, TIME_UTC) != TIME_UTC) fail("timespec_get failed");
    return result;
}
static double elapsed_ms(struct timespec start) {
    struct timespec end = start_time();
    double elapsed = (double)(end.tv_sec-start.tv_sec)*1000 + (double)(end.tv_nsec-start.tv_nsec)/1000000;
    if (elapsed < 0) fail("wall clock moved backwards; rerun benchmark");
    return elapsed;
}
static const char *fit_name(pg_fit fit) { return fit == PG_FIT_EXACT ? "exact" : "loose"; }
static memory_stats graph_memory(const graph *g) {
    memory_stats result = {0, 0, sizeof(pg_node)*g->count};
    for (size_t i = 0; i < g->count; ++i) for (size_t d = 0; d < 4; ++d) {
        result.bounds += g->nodes[i]->extents[d].count;
        result.capacity_bytes += g->nodes[i]->extents[d].capacity*sizeof(pg_bound);
    }
    return result;
}
static void row(const char *operation, const char *shape, pg_fit fit, size_t nodes,
                 size_t iterations, double elapsed, pg_layout_metrics metrics,
                 memory_stats memory, size_t cache_valid, double checksum) {
    result_sink += checksum;
    printf("%s,%s,%s,%zu,%zu,%.6f,%" PRIu64 ",%" PRIu64 ",%" PRIu64 ",%" PRIu64
           ",%zu,%zu,%zu,%zu,%.9g\n", operation, shape, fit_name(fit), nodes,
           iterations, elapsed, metrics.nodes_committed, metrics.nodes_measured,
           metrics.work_units, metrics.clean_subtrees_skipped, memory.bounds,
           memory.capacity_bytes, memory.node_bytes, cache_valid, checksum);
}
static pg_status measure(pg_node *node, double out[2], void *context) {
    (void)context;
    const body *b = pg_node_value(node);
    out[0] = b->width; out[1] = b->height;
    return PG_OK;
}
static double separation(pg_node *node, pg_axis axis, pg_direction direction,
                          bool prefer_vertical, void *context) {
    (void)node; (void)axis; (void)direction; (void)prefer_vertical; (void)context;
    return 4;
}
static graph graph_storage(size_t count) {
    require(count <= SIZE_MAX/sizeof(pg_node *) && count <= SIZE_MAX/sizeof(body), "node count overflows allocation");
    graph g = {calloc(count, sizeof *g.nodes), calloc(count, sizeof *g.bodies), count, NULL};
    require(g.nodes && g.bodies, "cannot allocate graph storage");
    return g;
}
static void make_node(graph *g, size_t i, pg_fit fit) {
    g->bodies[i] = (body){24, 16};
    g->nodes[i] = pg_node_new(&g->bodies[i]);
    require(g->nodes[i] != NULL, "cannot allocate graph node");
    check(pg_node_set_fit(g->nodes[i], fit));
}
static void prepare_layout(graph *g) {
    const pg_layout_painter painter = {measure, separation, NULL};
    g->layout = pg_layout_new(g->nodes[0], &painter);
    require(g->layout != NULL, "cannot allocate layout");
}
static void destroy_graph(graph *g) {
    pg_layout_free(g->layout);
    pg_node_free_tree(g->nodes[0]);
    free(g->nodes); free(g->bodies);
    memset(g, 0, sizeof *g);
}
static graph make_graph(const char *shape, size_t count, pg_fit fit) {
    graph g = graph_storage(count);
    for (size_t i = 0; i < count; ++i) make_node(&g, i, fit);
    if (strcmp(shape, "deep") == 0) {
        for (size_t i = 1; i < count; ++i) check(pg_node_connect(g.nodes[i-1], PG_FORWARD, g.nodes[i]));
    } else if (strcmp(shape, "balanced") == 0) {
        for (size_t i = 1; i < count; ++i)
            check(pg_node_connect(g.nodes[(i-1)/2], i%2 ? PG_FORWARD : PG_DOWNWARD, g.nodes[i]));
    } else {
        /* A horizontal spine with successively shorter upward teeth produces
         * a genuine staircase envelope. Exact union retains its detail. */
        size_t spine_count = (count+1)/2;
        for (size_t i = 1; i < spine_count; ++i) check(pg_node_connect(g.nodes[i-1], PG_FORWARD, g.nodes[i]));
        for (size_t i = spine_count; i < count; ++i) {
            size_t spine = i-spine_count;
            g.bodies[i] = (body){12, 16 + (double)(count-i)*2};
            check(pg_node_connect(g.nodes[spine], PG_UPWARD, g.nodes[i]));
        }
    }
    prepare_layout(&g);
    return g;
}

static void construction_and_walk(size_t count) {
    pg_layout_metrics none = {0};
    struct timespec time = start_time();
    graph g = make_graph("deep", count, PG_FIT_LOOSE);
    double elapsed = elapsed_ms(time);
    memory_stats memory = graph_memory(&g);
    row("construct", "deep", PG_FIT_LOOSE, count, 1, elapsed, none, memory, 0, count);
    uint64_t sum = 0;
    size_t repetitions = 64;
    time = start_time();
    for (size_t repeat = 0; repeat < repetitions; ++repeat)
        for (pg_node *n = g.nodes[0]; n; n = pg_node_at(n, PG_FORWARD)) sum += pg_node_id(n);
    elapsed = elapsed_ms(time);
    row("node_walk", "deep", PG_FIT_LOOSE, count, repetitions, elapsed, none, memory, 0, (double)sum);
    pg_caret *caret = pg_caret_new(g.nodes[0]);
    require(caret != NULL, "cannot allocate caret");
    sum = 0;
    time = start_time();
    for (size_t repeat = 0; repeat < repetitions; ++repeat) {
        check(pg_caret_move_to(caret, g.nodes[0]));
        for (size_t i = 0; i < count; ++i) {
            sum += pg_node_id(pg_caret_node(caret));
            if (i+1 < count) check(pg_caret_move(caret, PG_FORWARD));
        }
    }
    elapsed = elapsed_ms(time);
    row("caret_walk", "deep", PG_FIT_LOOSE, count, repetitions, elapsed, none, memory, 0, (double)sum);
    pg_caret_free(caret);
    destroy_graph(&g);

    g = graph_storage(count);
    make_node(&g, 0, PG_FIT_LOOSE);
    caret = pg_caret_new(g.nodes[0]);
    require(caret != NULL, "cannot allocate caret");
    time = start_time();
    for (size_t i = 1; i < count; ++i) {
        g.bodies[i] = (body){24, 16};
        check(pg_caret_spawn_move(caret, PG_FORWARD, &g.bodies[i], PG_ALIGN_NULL, &g.nodes[i]));
    }
    elapsed = elapsed_ms(time);
    row("caret_spawn", "deep", PG_FIT_LOOSE, count, 1, elapsed, none, graph_memory(&g), 0, count);
    /* Mark setup is outside the lookup timer; keys are precomputed too. */
    require(count <= SIZE_MAX/32, "mark count overflows allocation");
    char (*keys)[32] = calloc(count, sizeof *keys);
    require(keys != NULL, "cannot allocate mark keys");
    for (size_t i = 0; i < count; ++i) {
        snprintf(keys[i], sizeof keys[i], "node-%zu", i);
        check(pg_caret_move_to(caret, g.nodes[i]));
        check(pg_caret_save(caret, keys[i]));
    }
    sum = 0;
    time = start_time();
    for (size_t repeat = 0; repeat < repetitions; ++repeat)
        for (size_t i = 0; i < count; ++i) {
            check(pg_caret_restore(caret, keys[i]));
            sum += pg_node_id(pg_caret_node(caret));
        }
    elapsed = elapsed_ms(time);
    row("caret_restore", "marks", PG_FIT_LOOSE, count, repetitions, elapsed, none, graph_memory(&g), 0, (double)sum);
    free(keys);
    pg_caret_free(caret);
    destroy_graph(&g);
}

static void extent_combinations(size_t count, size_t repetitions) {
    pg_extent a = {0}, b = {0}, result = {0};
    for (size_t i = 0; i < count; ++i) {
        check(pg_extent_append(&a, 1, 2 + (double)(i%31)));
        check(pg_extent_append(&b, 1, 1 + (double)((i*17)%47)));
    }
    pg_layout_metrics none = {0};
    for (int fit = PG_FIT_EXACT; fit <= PG_FIT_LOOSE; ++fit) {
        double checksum = 0;
        struct timespec time = start_time();
        for (size_t repeat = 0; repeat < repetitions; ++repeat) {
            if (fit == PG_FIT_EXACT) check(pg_extent_combine(&result, &a, &b, .5, 2, 1));
            else check(pg_extent_combine_simplified(&result, &a, &b, .5, 2, 1));
            checksum += result.count;
        }
        double elapsed = elapsed_ms(time);
        memory_stats memory = {result.count, result.capacity*sizeof(pg_bound), 0};
        row("extent_combine", "sawtooth", (pg_fit)fit, count, repetitions, elapsed, none, memory, 0, checksum);
        pg_extent_destroy(&result);
    }
    pg_extent_destroy(&a); pg_extent_destroy(&b);
}

static void layout_workloads(const char *shape, size_t count, pg_fit fit, size_t repetitions) {
    graph g = make_graph(shape, count, fit);
    struct timespec time = start_time();
    check(pg_layout_run(g.layout));
    double elapsed = elapsed_ms(time);
    pg_layout_metrics metrics;
    pg_layout_get_metrics(g.layout, &metrics);
    require(metrics.nodes_committed == count, "full layout did not commit all nodes");
    row("full_layout", shape, fit, count, 1, elapsed, metrics, graph_memory(&g), 0, metrics.nodes_committed);
    pg_layout_clear_metrics(g.layout);
    time = start_time();
    for (size_t i = 0; i < 1000; ++i) check(pg_layout_run(g.layout));
    elapsed = elapsed_ms(time);
    pg_layout_get_metrics(g.layout, &metrics);
    require(metrics.nodes_committed == 0 && metrics.work_units == 0, "no-op layout traversed a clean graph");
    row("noop_layout", shape, fit, count, 1000, elapsed, metrics, graph_memory(&g), 0, 1000);

    pg_layout_clear_metrics(g.layout);
    time = start_time();
    for (size_t i = 0; i < repetitions; ++i) {
        g.bodies[count-1].height += 1;
        pg_node_invalidate(g.nodes[count-1]);
        check(pg_layout_run(g.layout));
    }
    elapsed = elapsed_ms(time);
    pg_layout_get_metrics(g.layout, &metrics);
    row("leaf_resize", shape, fit, count, repetitions, elapsed, metrics, graph_memory(&g), 0, g.bodies[count-1].height);

    pg_layout_clear_metrics(g.layout);
    time = start_time();
    double checksum = 0;
    for (size_t i = 0; i < count; ++i) {
        pg_transform t;
        check(pg_node_absolute_transform(g.nodes[i], &t));
        checksum += t.x+t.y+t.scale;
    }
    elapsed = elapsed_ms(time);
    row("flatten_cold", shape, fit, count, 1, elapsed, (pg_layout_metrics){0}, graph_memory(&g), 0, checksum);
    time = start_time(); checksum = 0;
    for (size_t i = 0; i < count; ++i) {
        pg_transform t;
        check(pg_node_absolute_transform(g.nodes[i], &t));
        checksum += t.x+t.y+t.scale;
    }
    elapsed = elapsed_ms(time);
    row("flatten_warm", shape, fit, count, 1, elapsed, (pg_layout_metrics){0}, graph_memory(&g), 0, checksum);
    destroy_graph(&g);
}

static cache_snapshot *warm_local_caches(graph *g, size_t begin) {
    cache_snapshot *snapshot = calloc(g->count-begin, sizeof *snapshot);
    require(snapshot != NULL, "cannot allocate cache snapshots");
    for (size_t i = begin; i < g->count; ++i) {
        pg_transform t;
        check(pg_node_group_transform(g->nodes[i], &t));
        snapshot[i-begin] = (cache_snapshot){t.x, t.y, t.scale, g->nodes[i]->group_seen};
    }
    return snapshot;
}
static size_t local_caches_retained(const graph *g, size_t begin, const cache_snapshot *snapshots) {
    size_t count = 0;
    for (size_t i = begin; i < g->count; ++i) {
        const pg_node *n = g->nodes[i];
        const cache_snapshot *s = &snapshots[i-begin];
        if (n->group_seen == s->seen && n->group_seen == n->group_root->group_generation &&
            n->group_x == s->x && n->group_y == s->y && n->group_scale == s->scale) ++count;
    }
    return count;
}
static void grouped_workloads(size_t count) {
    /* 0=root, 1=sibling, 2=outer group, 3=large nested group; remaining nodes
     * form a balanced forward/downward subtree inside group 3. */
    graph g = graph_storage(count+4);
    for (size_t i = 0; i < g.count; ++i) make_node(&g, i, PG_FIT_LOOSE);
    check(pg_node_connect(g.nodes[0], PG_FORWARD, g.nodes[1]));
    check(pg_node_connect(g.nodes[0], PG_DOWNWARD, g.nodes[2]));
    check(pg_node_connect(g.nodes[2], PG_FORWARD, g.nodes[3]));
    check(pg_node_crease(g.nodes[2])); check(pg_node_crease(g.nodes[3]));
    for (size_t i = 4; i < g.count; ++i) {
        size_t relative = i-3;
        check(pg_node_connect(g.nodes[3+(relative-1)/2], relative%2 ? PG_FORWARD : PG_DOWNWARD, g.nodes[i]));
    }
    prepare_layout(&g);
    check(pg_layout_run(g.layout));
    const size_t repetitions = 64;
    for (int mutation = 0; mutation < 4; ++mutation) {
        cache_snapshot *snapshots = warm_local_caches(&g, 3);
        pg_transform before, after;
        check(pg_node_absolute_transform(g.nodes[g.count-1], &before));
        pg_layout_clear_metrics(g.layout);
        struct timespec time = start_time();
        const char *operations[] = {"group_sibling_resize", "group_root_resize", "group_outer_scale", "group_large_scale"};
        for (size_t repeat = 0; repeat < repetitions; ++repeat) {
            if (mutation == 0) {
                g.bodies[1].height += 1000;
                pg_node_invalidate(g.nodes[1]);
            } else if (mutation == 1) {
                /* Exceed the current separation even when a large sibling
                 * already dominates the envelope. */
                if (!repeat) g.bodies[0].height = 4*pg_node_separation(g.nodes[0], PG_DOWNWARD)+1000;
                else g.bodies[0].height += 1000;
                pg_node_invalidate(g.nodes[0]);
            } else if (mutation == 2) {
                check(pg_node_set_scale(g.nodes[2], repeat%2 ? .5 : .75));
            } else {
                check(pg_node_set_scale(g.nodes[3], repeat%2 ? .5 : .75));
            }
            check(pg_layout_run(g.layout));
        }
        double elapsed = elapsed_ms(time);
        pg_layout_metrics metrics;
        pg_layout_get_metrics(g.layout, &metrics);
        size_t retained = local_caches_retained(&g, 3, snapshots);
        require(metrics.nodes_committed <= 3*repetitions, "group movement recommitted interior nodes");
        require(retained == count+1, "group movement or scale invalidated unchanged local cache");
        /* Query after checking retention: querying may itself rebuild caches. */
        check(pg_node_absolute_transform(g.nodes[g.count-1], &after));
        require(before.x != after.x || before.y != after.y || before.scale != after.scale,
                "group workload did not change the world transform");
        row(operations[mutation], "nested_groups", PG_FIT_LOOSE, g.count, repetitions, elapsed, metrics,
            graph_memory(&g), retained, after.x+after.y+after.scale);
        free(snapshots);
    }
    destroy_graph(&g);
}

static size_t parse_count(const char *text) {
    char *end;
    errno = 0;
    unsigned long long value = strtoull(text, &end, 10);
    if (errno || !*text || *text == '-' || *end || value < 2 || value > SIZE_MAX-4)
        fail("--nodes must be an integer of at least 2");
    return (size_t)value;
}
int main(int argc, char **argv) {
    size_t count = 2000;
    for (int i = 1; i < argc; ++i) {
        if (strcmp(argv[i], "--nodes") == 0 && i+1 < argc) count = parse_count(argv[++i]);
        else if (strcmp(argv[i], "--help") == 0) {
            puts("Usage: parsegraph_benchmark [--nodes N]\nCSV on stdout. Default N=2000. Exact comb can require quadratic time/memory.");
            return 0;
        } else fail("usage: parsegraph_benchmark [--nodes N]");
    }
    printf("operation,shape,fit,nodes,iterations,elapsed_ms,nodes_committed,nodes_measured,work_units,clean_subtrees_skipped,extent_bounds,extent_capacity_bytes,node_bytes,local_cache_retained,checksum\n");
    construction_and_walk(count);
    extent_combinations(count, 64);
    const char *shapes[] = {"deep", "balanced", "comb"};
    for (size_t i = 0; i < sizeof shapes/sizeof *shapes; ++i)
        for (int fit = PG_FIT_EXACT; fit <= PG_FIT_LOOSE; ++fit)
            layout_workloads(shapes[i], count, (pg_fit)fit, 3);
    grouped_workloads(count);
    fprintf(stderr, "node_struct_bytes=%zu bound_bytes=%zu checksum=%.9g\n", sizeof(pg_node), sizeof(pg_bound), result_sink);
    return 0;
}
