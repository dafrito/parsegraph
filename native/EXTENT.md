# Native Extent prototype

A C11 port of `src/DirectionNode/Layout/Extent`, including combination and
separation. This was the first native component; the full graph/layout API is now
documented in [README.md](README.md). The TypeScript implementation remains supported; defects
discovered during this port now have fixes and regression coverage there as well.

## Build and test on macOS

From the repository root, with a C/C++ compiler, CMake 3.18+, and the existing
Node/Yarn development dependencies installed:

```sh
cmake -S native -B native/build -DCMAKE_BUILD_TYPE=Debug -DPARSEGRAPH_SANITIZE=ON
cmake --build native/build
ctest --test-dir native/build --output-on-failure
```

The output is `native/build/libparsegraph_extent.a`. The checked-in C++ smoke
consumer links to that same C library using the header's `extern "C"` boundary.
There is no C++ runtime dependency in the library itself.

For an optimized build, use a separate directory:

```sh
cmake -S native -B native/build-release -DCMAKE_BUILD_TYPE=Release
cmake --build native/build-release
ctest --test-dir native/build-release --output-on-failure
```

`-DPARSEGRAPH_TS_PARITY=OFF` disables the Node/TypeScript differential test;
the C tests and C++ consumer still run. `-DBUILD_TESTING=OFF` builds only the
library and requires neither Node nor a C++ compiler. No graphics, font,
platform framework, third-party allocator, or JSON library is required.
Sanitizers are enabled for Clang/GCC when requested. Do not use `-ffast-math`:
NaN gaps are meaningful. Floating-point contraction is disabled in these builds
to preserve separate multiply/add rounding like JavaScript.

## Representation and ownership

- One circular allocation of `pg_bound { float length; float size; }`, exactly
  **8 bytes per capacity slot**, with no per-bound allocations.
- Geometrically growing capacity, constant-time prepend/append when capacity
  permits, and two `memcpy` spans to preserve a wrapped sequence on growth.
  `reserve` lets a caller preallocate; `clear` retains that storage.
- Float32 storage and double arithmetic, matching the TypeScript representation.
  Adjacent equal sizes, including two NaN gaps, merge on insertion. Equality is
  tested before rounding the incoming size, as in TypeScript.
- A zero-initialized, stack-embeddable `pg_extent` owns its buffer. The public
  struct is a prototype convenience, **not a stable ABI**; fields are internal.
  Never assign or `memcpy` an owning extent. `copy` makes an independent copy;
  `move` destroys the old destination and transfers ownership, zeroing the source.
  Both handle self-operation. `destroy` releases storage and zeroes the object.
- Bounding values are cached with an explicit validity flag, including empty
  and all-gap extents. All relevant mutations invalidate the cache.
- `offset` is metadata; mathematical operations take their own displacement.
  Copy/move preserve it, clear/simplify retain it, and combination creates a
  result with offset zero, even when output aliases an input.

All pointer arguments must be non-null and extents initialized. The API is not
internally synchronized. No object allocator or hidden global configuration is
needed. See [extent.h](include/parsegraph/extent.h) for the complete interface.

```c
#include <parsegraph/extent.h>

int example(void) {
    pg_extent a = {0}, b = {0};
    double separation = 0;
    pg_status status = pg_extent_append(&a, 50, 25);
    if (status == PG_OK) status = pg_extent_append(&b, 12, 6);
    if (status == PG_OK)
        status = pg_extent_separation(&a, &b, 0, true, 1, &separation);
    /* separation == 31 on success */
    pg_extent_destroy(&a);
    pg_extent_destroy(&b);
    return status;
}
```

## Behavior and deliberate boundaries

The port covers insertion, indexed access/mutation, size lookup, bounds,
scaling, size adjustment, simplification, combination (including the simplified
shortcut), separation, equality, offsets, deep copy, and ownership transfer.
The redundant size/length argument-order aliases, JavaScript callback iteration,
and console dump helper are not separate C APIs; count/get allow ordinary loops.

Lengths must be positive finite numbers representable as nonzero float32.
Zero-length insertion is a no-op; setters reject zero. Sizes may be finite
float32 values, including negative sizes, or NaN gaps. Scales must be positive
and finite. Invalid inputs, unrepresentable results/capacities, and allocation
failures return status codes rather than exceptions or silent buffer corruption.
Failed operations leave destination contents unchanged. Combination builds a
temporary result before transferring it, so the output may alias either input.

`size_at` uses the existing inclusive endpoint convention: an internal endpoint
belongs to the preceding bound. Past the last endpoint and inside gaps it
returns NaN. Combination uses a NaN-aware maximum; the simplified-combination
shortcut deliberately retains TypeScript's `Math.max` NaN propagation when
either maximum is NaN. This shortcut is not always equivalent to combining
then simplifying an empty/all-gap input.

The prototype intentionally rejects infinity, zero/negative scaling and
float32 length underflow rather than reproducing permissive TypeScript inputs.
Reserve is grow-only and a no-op when already sufficient; unlike TS `realloc`,
requesting the same or smaller capacity does not throw. Equality uses signed
differences, explicit tolerance for both components, and equal NaN gap sizes.
TypeScript `copyFrom` remains a destructive transfer of bounds that preserves
each object's offset; it now swaps independent buffers for safe source reuse.
C `move` transfers the entire owner, including offset, and zeroes the source.

## Validation and resolved TypeScript defects

Validated on Apple Silicon with Apple Clang 21. Four CTest checks cover:

1. C API behavior and a 10,000-operation circular-buffer stress test against an
   independent flat-list model, plus ownership, cache and error behavior.
2. A C++ consumer compiling and linking against the C library.
3. Allocation-failure injection, including every allocation in a combining
   operation; failed operations preserve the destination and free temporaries.
4. **620 deterministic input pairs** compared against the live TypeScript
   sources for combination, bounding values, simplified combination and
   separation. An independent piecewise-interval oracle checks separation.

The seven original `Extent.spec.ts` scenarios were also reviewed against the C
suite. The following mapping distinguishes inherited cases from additional
native tests (all functions below are in `tests/extent_test.c`):

| Original test | C coverage |
| --- | --- |
| `can simplify` | `storage`: equal-size insertion coalesces; simplification also collapses a genuinely multi-bound extent and checks its length/maximum. The original input already coalesces before simplify runs. |
| `Extent.numBounds` | `ring_stress`: checks count and every logical bound against a flat-list model after each insertion, including coalescing and clear/reuse. |
| `Extent.separation` | `inherited_separation`: exact four-step progression, 20 → 40 → 60 → 60, in both directions. |
| `Extent.Simple combinedExtent` | `inherited_combinations`: exact unshifted result, including the trailing base bound. |
| `Extent.equals` | `inherited_gap_equality`: separately constructed matching gaps, plus gap-versus-zero rejection in both directions. |
| `Extent.combinedExtent with NaN` | `inherited_combinations`: explicit NaN setter, separation of 30, and all three expected result bounds. |
| `Extent.combinedExtent` | `algorithms`: exact shifted three-bound result, additionally checking in-place aliasing. |

The port exposed the following TypeScript defects. All four are now fixed in
TypeScript, with regressions in `Extent.regression.spec.ts` and
`fuzzyequals.spec.ts`. These are historical reproductions, not remaining parity
exceptions:

| Defect discovered during port | Corrected behavior / tracking |
| --- | --- |
| Growing a wrapped/prepended extent copies incorrect component indices. Three prepends `(1,10), (2,20), (3,30)` yield `[(3,30),(10,1),(10,0)]`. | Correct logical-order copy; [board issue](https://fritolaptop.fritonet.home.arpa/board/#board=59f354c3-a216-4792-9cf4-a2f5696fdea0&item=f267da84-a3ac-4123-aab3-bdbc109c5779). |
| `copyFrom` shares the buffer with the cleared source and fails to transfer the ring start. | Independent ownership after transfer; C also provides a deep copy operation; [board issue](https://fritolaptop.fritonet.home.arpa/board/#board=59f354c3-a216-4792-9cf4-a2f5696fdea0&item=c3814569-b540-4531-830e-96d355e0ac40). |
| Separation without axis overlap omits the base tail and partial leading spans. | Both tails and exposed prefixes count; [board issue](https://fritolaptop.fritonet.home.arpa/board/#board=59f354c3-a216-4792-9cf4-a2f5696fdea0&item=e1aeea0c-3aaf-41eb-95f2-acae39298f2a). |
| Equality compares magnitudes and ignores the explicit tolerance for sizes. | Signed difference and consistent tolerance; [board issue](https://fritolaptop.fritonet.home.arpa/board/#board=59f354c3-a216-4792-9cf4-a2f5696fdea0&item=6504f989-e4c0-449e-98a5-4520e0ffd2fa). |

The original deterministic corpus exposed 49 separation differences. It now
requires both C and TypeScript to agree with the independent oracle, with no
exceptions for those cases. The other minimal reproductions in
`tests/parity.cjs` now assert corrected behavior. TypeScript also checks 600
mixed buffer operations against a flat model and 600 separation scenarios
against interval geometry and scaled symmetry. No performance advantage is
claimed yet. Native CI and graph layout are now implemented; installation/distribution and
additional platform verification remain follow-up work.
