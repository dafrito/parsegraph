#include "parsegraph/caret.h"
#include <inttypes.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct pg_mark {
    struct pg_mark *next;
    char *key;
    pg_node *node;
    uint64_t hash;
} pg_mark;

struct pg_caret {
    pg_node *origin;
    pg_node **stack;
    size_t depth, capacity;
    pg_mark **marks;
    size_t mark_count, bucket_count;
    uint64_t next_id;
};

pg_caret *pg_caret_new(pg_node *node) {
    if (!node) return NULL;
    pg_caret *c = calloc(1, sizeof *c);
    if (!c) return NULL;
    c->capacity = 8;
    c->stack = malloc(c->capacity * sizeof *c->stack);
    if (!c->stack) { free(c); return NULL; }
    c->origin = node;
    c->stack[0] = node;
    c->depth = 1;
    return c;
}
pg_caret *pg_caret_clone(const pg_caret *c) { return pg_caret_new(pg_caret_node(c)); }
void pg_caret_clear_saves(pg_caret *c) {
    if (!c) return;
    for (size_t i = 0; i < c->bucket_count; ++i) {
        pg_mark *m = c->marks[i];
        while (m) { pg_mark *next = m->next; free(m->key); free(m); m = next; }
    }
    free(c->marks);
    c->marks = NULL;
    c->bucket_count = c->mark_count = 0;
}
void pg_caret_free(pg_caret *c) {
    if (!c) return;
    pg_caret_clear_saves(c);
    free(c->stack);
    free(c);
}
pg_node *pg_caret_node(const pg_caret *c) { return c && c->depth ? c->stack[c->depth - 1] : NULL; }
pg_node *pg_caret_origin(const pg_caret *c) { return c ? c->origin : NULL; }
pg_node *pg_caret_root(const pg_caret *c) { return pg_node_root(pg_caret_node(c)); }
pg_node *pg_caret_parent(const pg_caret *c) { return pg_node_parent(pg_caret_node(c)); }
pg_node *pg_caret_at(const pg_caret *c, pg_direction d) { return pg_node_at(pg_caret_node(c), d); }
bool pg_caret_has(const pg_caret *c, pg_direction d) { return pg_caret_at(c, d) != NULL; }
pg_status pg_caret_move_to(pg_caret *c, pg_node *node) {
    if (!c || !node) return PG_INVALID;
    c->stack[c->depth - 1] = node;
    return PG_OK;
}
pg_status pg_caret_move(pg_caret *c, pg_direction d) {
    if (!c || !pg_direction_valid(d)) return PG_INVALID;
    pg_node *dest = pg_caret_at(c, d);
    return dest ? pg_caret_move_to(c, dest) : PG_RANGE;
}
pg_status pg_caret_push(pg_caret *c) {
    if (!c) return PG_INVALID;
    if (c->depth == c->capacity) {
        if (c->capacity > SIZE_MAX / 2 / sizeof *c->stack) return PG_RANGE;
        size_t cap = c->capacity * 2;
        pg_node **stack = realloc(c->stack, cap * sizeof *stack);
        if (!stack) return PG_NOMEM;
        c->stack = stack;
        c->capacity = cap;
    }
    c->stack[c->depth] = c->stack[c->depth - 1];
    ++c->depth;
    return PG_OK;
}
pg_status pg_caret_pop(pg_caret *c) {
    if (!c) return PG_INVALID;
    if (c->depth == 1) return PG_RANGE;
    --c->depth;
    return PG_OK;
}
size_t pg_caret_depth(const pg_caret *c) { return c ? c->depth : 0; }

static uint64_t hash_key(const char *key) {
    uint64_t hash = UINT64_C(14695981039346656037);
    for (const unsigned char *p = (const unsigned char *)key; *p; ++p) {
        hash ^= *p;
        hash *= UINT64_C(1099511628211);
    }
    return hash;
}
static pg_mark *find_mark(const pg_caret *c, const char *key, uint64_t hash) {
    if (!c->bucket_count) return NULL;
    for (pg_mark *m = c->marks[hash & (c->bucket_count - 1)]; m; m = m->next)
        if (m->hash == hash && strcmp(m->key, key) == 0) return m;
    return NULL;
}
static pg_status grow_marks(pg_caret *c) {
    if (c->bucket_count && c->mark_count < c->bucket_count - c->bucket_count / 4) return PG_OK;
    if (c->bucket_count > SIZE_MAX / 2 / sizeof *c->marks) return PG_RANGE;
    size_t capacity = c->bucket_count ? c->bucket_count * 2 : 16;
    pg_mark **buckets = calloc(capacity, sizeof *buckets);
    if (!buckets) return PG_NOMEM;
    for (size_t i = 0; i < c->bucket_count; ++i) {
        pg_mark *m = c->marks[i];
        while (m) {
            pg_mark *next = m->next;
            size_t slot = m->hash & (capacity - 1);
            m->next = buckets[slot];
            buckets[slot] = m;
            m = next;
        }
    }
    free(c->marks);
    c->marks = buckets;
    c->bucket_count = capacity;
    return PG_OK;
}
pg_status pg_caret_save(pg_caret *c, const char *key) {
    if (!c || !key) return PG_INVALID;
    uint64_t hash = hash_key(key);
    pg_mark *m = find_mark(c, key, hash);
    if (m) { m->node = pg_caret_node(c); return PG_OK; }
    size_t len = strlen(key);
    if (len == SIZE_MAX) return PG_RANGE;
    m = malloc(sizeof *m);
    if (!m) return PG_NOMEM;
    m->key = malloc(len + 1);
    if (!m->key) { free(m); return PG_NOMEM; }
    memcpy(m->key, key, len + 1);
    pg_status status = grow_marks(c);
    if (status != PG_OK) { free(m->key); free(m); return status; }
    m->node = pg_caret_node(c);
    m->hash = hash;
    size_t slot = hash & (c->bucket_count - 1);
    m->next = c->marks[slot];
    c->marks[slot] = m;
    ++c->mark_count;
    return PG_OK;
}
pg_status pg_caret_save_auto(pg_caret *c, const char **key) {
    if (key) *key = NULL;
    if (!c || !key) return PG_INVALID;
    char buf[32];
    do {
        if (c->next_id == UINT64_MAX) return PG_RANGE;
        ++c->next_id;
        snprintf(buf, sizeof buf, "%" PRIu64, c->next_id);
    } while (find_mark(c, buf, hash_key(buf)));
    pg_status status = pg_caret_save(c, buf);
    if (status == PG_OK) *key = find_mark(c, buf, hash_key(buf))->key;
    return status;
}
pg_status pg_caret_restore(pg_caret *c, const char *key) {
    if (!c || !key) return PG_INVALID;
    pg_mark *m = find_mark(c, key, hash_key(key));
    return m ? pg_caret_move_to(c, m->node) : PG_RANGE;
}
void pg_caret_clear_save(pg_caret *c, const char *key) {
    if (!c || !key || !c->bucket_count) return;
    uint64_t hash = hash_key(key);
    pg_mark **link = &c->marks[hash & (c->bucket_count - 1)];
    while (*link) {
        pg_mark *m = *link;
        if (m->hash == hash && strcmp(m->key, key) == 0) {
            *link = m->next;
            free(m->key);
            free(m);
            --c->mark_count;
            return;
        }
        link = &m->next;
    }
}

pg_status pg_caret_connect(pg_caret *c, pg_direction d, pg_node *n) {
    return c ? pg_node_connect(pg_caret_node(c), d, n) : PG_INVALID;
}
pg_status pg_caret_connect_move(pg_caret *c, pg_direction d, pg_node *n) {
    pg_status status = pg_caret_connect(c, d, n);
    return status == PG_OK ? pg_caret_move_to(c, n) : status;
}
pg_node *pg_caret_disconnect(pg_caret *c, pg_direction d) { return pg_node_disconnect(pg_caret_node(c), d); }
static bool alignment_valid(pg_alignment a) { return a >= PG_ALIGN_NULL && a <= PG_ALIGN_INWARD_VERTICAL; }
pg_status pg_caret_spawn(pg_caret *c, pg_direction d, void *value, pg_alignment a, pg_node **out) {
    if (out) *out = NULL;
    if (!c || !pg_direction_valid(d) || !alignment_valid(a)) return PG_INVALID;
    pg_node *parent = pg_caret_node(c);
    pg_node *n = pg_node_new(value);
    if (!n) return PG_NOMEM;
    pg_status status = pg_node_connect(parent, d, n);
    if (status != PG_OK) { pg_node_free(n); return status; }
    /* These setters cannot fail for validated constants on valid nodes. Set
     * relative preference after attachment, when parent direction is known. */
    (void)pg_node_set_preferred_axis(n, PG_PREFERRED_PERPENDICULAR);
    (void)pg_node_set_fit(n, pg_node_fit(parent));
    if (a != PG_ALIGN_NULL) (void)pg_caret_align(c, d, a);
    if (out) *out = n;
    return PG_OK;
}
pg_status pg_caret_spawn_move(pg_caret *c, pg_direction d, void *value, pg_alignment a, pg_node **out) {
    pg_node *n = NULL;
    pg_status status = pg_caret_spawn(c, d, value, a, &n);
    if (status == PG_OK) (void)pg_caret_move_to(c, n);
    if (out) *out = n;
    return status;
}
void *pg_caret_value(const pg_caret *c) { return pg_node_value(pg_caret_node(c)); }
void *pg_caret_replace(pg_caret *c, void *value) {
    void *old = pg_caret_value(c);
    if (c) pg_node_set_value(pg_caret_node(c), value);
    return old;
}
pg_status pg_caret_pull(pg_caret *c, pg_direction d) { return c ? pg_node_pull(pg_caret_node(c), d) : PG_INVALID; }
pg_status pg_caret_align(pg_caret *c, pg_direction d, pg_alignment a) {
    if (!c) return PG_INVALID;
    pg_node *n = pg_caret_node(c);
    pg_status status = pg_node_set_alignment(n, d, a);
    if (status == PG_OK && a != PG_ALIGN_NONE) {
        pg_node *owner = d == PG_DIRECTION_NONE || d == pg_node_parent_direction(n) ? pg_node_parent(n) : n;
        status = pg_node_set_fit(owner, PG_FIT_EXACT);
    }
    return status;
}
pg_status pg_caret_align_parent(pg_caret *c, pg_alignment a) {
    if (!c || !alignment_valid(a)) return PG_INVALID;
    pg_node *n = pg_caret_node(c);
    pg_node *parent = pg_node_parent(n);
    if (!parent) return PG_RANGE;
    pg_direction direction = pg_direction_reverse(pg_node_parent_direction(n));
    pg_status status = pg_node_set_alignment(parent, direction, a);
    if (status == PG_OK && a != PG_ALIGN_NONE) status = pg_node_set_fit(parent, PG_FIT_EXACT);
    return status;
}
static pg_status target_node(const pg_caret *c, pg_direction d, pg_node **out) {
    if (!c || (d != PG_DIRECTION_NONE && !pg_direction_valid(d))) return PG_INVALID;
    *out = d == PG_DIRECTION_NONE ? pg_caret_node(c) : pg_caret_at(c, d);
    return *out ? PG_OK : PG_RANGE;
}
pg_status pg_caret_crease(pg_caret *c, pg_direction d) {
    pg_node *n; pg_status status = target_node(c, d, &n);
    return status == PG_OK ? pg_node_crease(n) : status;
}
pg_status pg_caret_uncrease(pg_caret *c, pg_direction d) {
    pg_node *n; pg_status status = target_node(c, d, &n);
    return status == PG_OK ? pg_node_uncrease(n) : status;
}
bool pg_caret_is_creased(const pg_caret *c, pg_direction d) {
    pg_node *n; return target_node(c, d, &n) == PG_OK && pg_node_is_paint_group(n);
}
pg_status pg_caret_shrink(pg_caret *c, pg_direction d) {
    pg_node *n; pg_status status = target_node(c, d, &n);
    return status == PG_OK ? pg_node_set_scale(n, PG_SHRINK_SCALE) : status;
}
pg_status pg_caret_grow(pg_caret *c, pg_direction d) {
    pg_node *n; pg_status status = target_node(c, d, &n);
    return status == PG_OK ? pg_node_set_scale(n, 1.0) : status;
}
pg_status pg_caret_set_fit(pg_caret *c, pg_direction d, pg_fit fit) {
    pg_node *n; pg_status status = target_node(c, d, &n);
    return status == PG_OK ? pg_node_set_fit(n, fit) : status;
}
pg_status pg_caret_fit_exact(pg_caret *c, pg_direction d) { return pg_caret_set_fit(c, d, PG_FIT_EXACT); }
pg_status pg_caret_fit_loose(pg_caret *c, pg_direction d) { return pg_caret_set_fit(c, d, PG_FIT_LOOSE); }
pg_status pg_caret_fit_naive(pg_caret *c, pg_direction d) { return pg_caret_set_fit(c, d, PG_FIT_NAIVE); }
