#include "primes.h"
#include "parsegraph/caret.h"

#include <stdio.h>
#include <stdlib.h>

struct pg_primes {
    pg_caret *caret;
    pg_primes_record **records;
    size_t size, capacity;
    int count, limit;
    int *known;
    size_t known_count;
    double side;
};

static pg_status reserve(pg_primes *p, size_t size) {
    if (size <= p->capacity) return PG_OK;
    size_t capacity = p->capacity ? p->capacity : 64;
    while (capacity < size) capacity *= 2;
    pg_primes_record **records = realloc(p->records, capacity * sizeof(*records));
    if (!records) return PG_NOMEM;
    p->records = records;
    p->capacity = capacity;
    return PG_OK;
}

static pg_primes_record *new_record(int number, int factor) {
    pg_primes_record *record = calloc(1, sizeof(*record));
    if (!record) return NULL;
    if (factor) {
        snprintf(record->id, sizeof(record->id), "primes-%d-factor-%d", number, factor);
        if (number % factor == 0)
            snprintf(record->text, sizeof(record->text), "%d", factor);
    } else {
        snprintf(record->id, sizeof(record->id), "primes-%d", number);
        snprintf(record->text, sizeof(record->text), "%d", number);
    }
    record->node = pg_node_new(record);
    if (!record->node) { free(record); return NULL; }
    return record;
}

pg_primes *pg_primes_new(int sizing_limit) {
    if (sizing_limit < 1 || sizing_limit > PG_PRIMES_MAX_COUNT) return NULL;
    pg_primes *p = calloc(1, sizeof(*p));
    if (!p) return NULL;
    p->limit = sizing_limit;
    p->known = malloc((size_t)sizing_limit * sizeof(*p->known));
    if (!p->known) { pg_primes_free(p); return NULL; }
    int digits = 1;
    for (int n = sizing_limit; n >= 10; n /= 10) ++digits;
    p->side = (digits + 2) * 10.0;
    if (reserve(p, 1) != PG_OK) { pg_primes_free(p); return NULL; }
    pg_primes_record *root = new_record(1, 0);
    if (!root) { pg_primes_free(p); return NULL; }
    p->records[p->size++] = root;
    p->caret = pg_caret_new(root->node);
    if (!p->caret) { pg_primes_free(p); return NULL; }
    p->count = 1;
    return p;
}

void pg_primes_free(pg_primes *p) {
    if (!p) return;
    pg_caret_free(p->caret);
    if (p->size) pg_node_free_tree(p->records[0]->node);
    for (size_t i = 0; i < p->size; ++i) free(p->records[i]);
    free(p->records);
    free(p->known);
    free(p);
}

static pg_status append_column(pg_primes *p, int number) {
    bool prime = true;
    for (size_t i = 0; i < p->known_count; ++i)
        if (number % p->known[i] == 0) prime = false;
    size_t count = 1 + p->known_count + (prime ? 1 : 0);
    pg_status status = reserve(p, p->size + count);
    if (status != PG_OK) return status;

    /* Acquire the whole column before changing the graph. These are leaves,
     * so attaching through the public API avoids ancestry scans of subtrees. */
    pg_primes_record **pending = calloc(count, sizeof(*pending));
    if (!pending) return PG_NOMEM;
    for (size_t i = 0; i < count; ++i) {
        int factor = !i ? 0 : i <= p->known_count ? p->known[i-1] : number;
        pending[i] = new_record(number, factor);
        if (!pending[i]) {
            for (size_t j = 0; j < i; ++j) {
                pg_node_free(pending[j]->node);
                free(pending[j]);
            }
            free(pending);
            return PG_NOMEM;
        }
    }
    pg_node *previous = pg_caret_node(p->caret);
    for (size_t i = 0; i < count; ++i) {
        pg_direction direction = i ? PG_UPWARD : PG_FORWARD;
        status = pg_caret_connect_move(p->caret, direction, pending[i]->node);
        if (status != PG_OK) {
            /* Defensive rollback: topology constructed here has no occupied
             * directions or cycles, so connection failures are unexpected. */
            (void)pg_caret_move_to(p->caret, previous);
            for (size_t j = count; j-- > 0;) {
                pg_node_free(pending[j]->node);
                free(pending[j]);
            }
            free(pending);
            return status;
        }
        /* Match spawnMove: inherited loose fit and perpendicular preference. */
        (void)pg_node_set_preferred_axis(pending[i]->node, PG_PREFERRED_PERPENDICULAR);
        if (!i) (void)pg_caret_pull(p->caret, PG_UPWARD);
        if (i && i <= p->known_count && (i-1) % 250 == 0)
            (void)pg_caret_crease(p->caret, PG_DIRECTION_NONE);
    }
    (void)pg_caret_move_to(p->caret, pending[0]->node);
    for (size_t i = 0; i < count; ++i) p->records[p->size++] = pending[i];
    free(pending);
    if (prime) p->known[p->known_count++] = number;
    p->count = number;
    return PG_OK;
}

pg_status pg_primes_append(pg_primes *p, int target) {
    if (!p) return PG_INVALID;
    if (target < p->count || target > p->limit) return PG_RANGE;
    while (p->count < target) {
        pg_status status = append_column(p, p->count + 1);
        if (status != PG_OK) return status;
    }
    return PG_OK;
}

pg_node *pg_primes_root(const pg_primes *p) { return p && p->size ? p->records[0]->node : NULL; }
int pg_primes_count(const pg_primes *p) { return p ? p->count : 0; }
size_t pg_primes_node_count(const pg_primes *p) { return p ? p->size : 0; }
double pg_primes_cell_side(const pg_primes *p) { return p ? p->side : 0; }
const pg_primes_record *pg_primes_record_at(const pg_primes *p, size_t index) {
    return p && index < p->size ? p->records[index] : NULL;
}
