#ifndef PARSEGRAPH_EXAMPLE_PRIMES_H
#define PARSEGRAPH_EXAMPLE_PRIMES_H

#include "parsegraph/node.h"

#ifdef __cplusplus
extern "C" {
#endif

/* A native counterpart of examples/generators/primes.ts. This example owns
 * its nodes and their values; it does not own a layout or graphics resources.
 * Values point to stable records, including across successful appends. */
typedef struct pg_primes pg_primes;
typedef struct pg_primes_record {
    pg_node *node;
    char id[48];
    char text[16];
} pg_primes_record;

/* Starts with the node "1". sizing_limit must be 1..1000; all cells use the
 * final target's number of digits, avoiding resizing at 10/100/1000 during
 * growth. cell_side is the math presentation's (digits + 2) * font size 10. */
pg_primes *pg_primes_new(int sizing_limit);
void pg_primes_free(pg_primes *primes);
/* Appends columns through target inclusive; current <= target <= sizing_limit.
 * Allocation failure retains complete columns already added in this call,
 * never a partially constructed column. Layouts may be reused after append. */
pg_status pg_primes_append(pg_primes *primes, int target);
pg_node *pg_primes_root(const pg_primes *primes);
int pg_primes_count(const pg_primes *primes);
size_t pg_primes_node_count(const pg_primes *primes);
double pg_primes_cell_side(const pg_primes *primes);
/* Creation order; out-of-range indexes return NULL. Records/nodes are borrowed
 * until pg_primes_free. Do not detach, destroy, or reparent borrowed nodes. */
const pg_primes_record *pg_primes_record_at(const pg_primes *primes, size_t index);

#ifdef __cplusplus
}
#endif
#endif
