/* Timings are observations, never pass/fail thresholds. No Qt, JSON, text
 * shaping, rendering or per-frame transforms are included in this benchmark. */
#define _POSIX_C_SOURCE 200809L
#include "primes.h"
#include "parsegraph/layout.h"

#include <errno.h>
#include <inttypes.h>
#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#else
#include <time.h>
#endif

static void fail(const char *message) { fprintf(stderr, "primes benchmark: %s\n", message); exit(1); }
static void check(pg_status status) { if (status != PG_OK) fail("native operation failed"); }
static double now_ms(void) {
#ifdef _WIN32
    LARGE_INTEGER ticks, frequency;
    if (!QueryPerformanceCounter(&ticks) || !QueryPerformanceFrequency(&frequency)) fail("monotonic clock failed");
    return (double)ticks.QuadPart * 1000.0 / (double)frequency.QuadPart;
#else
    struct timespec t;
    if (clock_gettime(CLOCK_MONOTONIC, &t) != 0) fail("monotonic clock failed");
    return (double)t.tv_sec * 1000.0 + (double)t.tv_nsec / 1000000.0;
#endif
}
static pg_status measure(pg_node *node, double size[2], void *context) {
    (void)node;
    size[0] = size[1] = pg_primes_cell_side(context);
    return PG_OK;
}
static pg_layout *new_layout(pg_primes *p) {
    pg_layout_painter painter = {measure, NULL, p};
    pg_layout *layout = pg_layout_new(pg_primes_root(p), &painter);
    if (!layout) fail("cannot allocate layout");
    return layout;
}
static int compare_double(const void *a, const void *b) {
    double x = *(const double *)a, y = *(const double *)b;
    return (x > y) - (x < y);
}
static double percentile(const double *samples, size_t count, double percentile_value) {
    if (!count) return 0;
    size_t index = (size_t)ceil(percentile_value * count) - 1;
    return samples[index];
}
static void add_metrics(pg_layout_metrics *total, const pg_layout_metrics *part) {
    total->work_units += part->work_units;
    total->nodes_committed += part->nodes_committed;
    total->nodes_measured += part->nodes_measured;
    total->clean_subtrees_skipped += part->clean_subtrees_skipped;
    total->restarts += part->restarts;
}
static void row(const char *scenario, int repeat, pg_primes *p, int batch, size_t samples,
                double construction, double layout_ms, double *updates,
                const pg_layout_metrics *metrics) {
    qsort(updates, samples, sizeof(*updates), compare_double);
    size_t groups = 0;
    for (size_t i = 0; i < pg_primes_node_count(p); ++i)
        groups += pg_node_is_paint_group(pg_primes_record_at(p, i)->node);
    printf("%s,%d,%d,%zu,%zu,%d,%zu,%.6f,%.6f,%.6f,%.6f,%.6f,%" PRIu64 ",%" PRIu64 ",%" PRIu64 ",%" PRIu64 "\n",
           scenario, repeat, pg_primes_count(p), pg_primes_node_count(p), groups, batch,
           samples, construction, layout_ms, percentile(updates, samples, .5),
           percentile(updates, samples, .95), samples ? updates[samples-1] : 0,
           metrics->nodes_committed, metrics->nodes_measured,
           metrics->clean_subtrees_skipped, metrics->work_units);
    fflush(stdout);
}
static void cold(int count, int repeat) {
    double start = now_ms();
    pg_primes *p = pg_primes_new(count); if (!p) fail("cannot allocate graph");
    check(pg_primes_append(p, count));
    double construction = now_ms() - start;
    pg_layout *layout = new_layout(p);
    start = now_ms(); check(pg_layout_run(layout));
    double elapsed = now_ms() - start;
    pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
    row("cold", repeat, p, 0, 1, construction, elapsed, &elapsed, &metrics);
    pg_layout_free(layout); pg_primes_free(p);
}
static void grow(int count, int batch, int repeat) {
    pg_primes *p = pg_primes_new(count); if (!p) fail("cannot allocate graph");
    pg_layout *layout = new_layout(p); check(pg_layout_run(layout));
    double *samples = malloc((size_t)count * sizeof(*samples));
    if (!samples) fail("cannot allocate timing samples");
    double construction = 0, layout_ms = 0;
    size_t sample_count = 0;
    pg_layout_metrics total = {0};
    while (pg_primes_count(p) < count) {
        int target = pg_primes_count(p) + batch;
        if (target > count) target = count;
        double start = now_ms(); check(pg_primes_append(p, target));
        construction += now_ms() - start;
        pg_layout_clear_metrics(layout);
        start = now_ms(); check(pg_layout_run(layout));
        double elapsed = now_ms() - start;
        samples[sample_count++] = elapsed;
        layout_ms += elapsed;
        pg_layout_metrics metrics; pg_layout_get_metrics(layout, &metrics);
        add_metrics(&total, &metrics);
    }
    row("growth", repeat, p, batch, sample_count, construction, layout_ms, samples, &total);
    free(samples);
    pg_layout_free(layout); pg_primes_free(p);
}
static int integer(const char *text, int maximum) {
    char *end;
    errno = 0;
    long value = strtol(text, &end, 10);
    if (errno || !*text || *end || value < 1 || value > maximum) fail("invalid numeric argument");
    return (int)value;
}
int main(int argc, char **argv) {
    int requested_count = 0, repeats = 1;
    bool cold_only = false;
    for (int i = 1; i < argc; ++i) {
        if (!strcmp(argv[i], "--help")) {
            printf("Usage: parsegraph_primes_benchmark [--count 1..%d] [--repeats 1..100] [--cold-only]\n",
                   PG_PRIMES_MAX_COUNT);
            puts(
                 "Default counts: 30,100,300,1000; cold build and incremental batches 1/10.\n"
                 "--cold-only skips incremental growth for large graph measurements.\n"
                 "Growth keeps the original layout and final-target cell size. Its timings\n"
                 "exclude initial root layout and report per-update layout percentiles.\n"
                 "CSV stdout; native topology construction and layout measured separately.");
            return 0;
        }
        if (!strcmp(argv[i], "--cold-only")) { cold_only = true; continue; }
        if (i+1 >= argc) fail("missing argument value");
        if (!strcmp(argv[i], "--count")) requested_count = integer(argv[++i], PG_PRIMES_MAX_COUNT);
        else if (!strcmp(argv[i], "--repeats")) repeats = integer(argv[++i], 100);
        else fail("unknown argument");
    }
    puts("scenario,repeat,count,nodes,groups,batch,updates,construction_ms,layout_ms,update_p50_ms,update_p95_ms,update_max_ms,committed,measured,clean_skipped,work_units");
    const int counts[] = {30, 100, 300, 1000};
    for (int repeat = 1; repeat <= repeats; ++repeat) {
        size_t limit = requested_count ? 1 : sizeof(counts)/sizeof(*counts);
        for (size_t i = 0; i < limit; ++i) {
            int count = requested_count ? requested_count : counts[i];
            cold(count, repeat);
            if (!cold_only) { grow(count, 1, repeat); grow(count, 10, repeat); }
        }
    }
    return 0;
}
