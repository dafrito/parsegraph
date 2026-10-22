# Recovering publication of an existing release

Use this only when a stable GitHub release already exists but its npm publication
failed. Do not move its tag, change its version, or replace its release assets.

1. Commit the publisher fix on `main`. Keep package inputs unchanged if recovering
   the existing archive; this note, release tools, tests, and workflows are excluded
   from the npm package. `DEPLOYING.md` is included, so changing it changes the archive.
2. In GitHub Actions, select **Release → Run workflow**, choose **main**, and enter
   the existing `release_tag` and its original full `release_commit`. For 7.0.1,
   these are `v7.0.1` and `b028da9068b37f2fe986e21b1703a49ac195e6ca`.
3. The guard requires the matching stable, published release, an unchanged tag,
   matching package identity, and the original commit as an ancestor of the actual
   workflow source. The entire reusable CI workflow then runs on that source.
4. Publication verifies the new CI assets against their seal and downloads the
   original release assets to verify their original seal. The npm archive and its
   receipt must be byte-for-byte identical; documentation archives may differ
   between builds, but each must match its own checksums. Any mismatch stops recovery.

The existing npm integrity guard remains in effect: an identical published version
is accepted without republishing or changing dist-tags; different bytes are rejected.
Recovery does not upload, remove, or replace any GitHub release assets.

Provenance records the **actual recovery workflow commit**, which CI has shown
produces the same package bytes as the original tagged release. It does not pretend
the recovery ran at the tag. Record the recovery commit and workflow run in the
release notes when reporting successful publication.

The publisher makes one npm invocation with a 60-second HTTP timeout, no automatic
request retries, HTTP status logging, and a three-minute process deadline. If that
invocation fails, it checks the registry once: exact matching integrity confirms a
successful upload with a lost response; absence, conflicting bytes, or an unreadable
registry leaves the job failed. Inspect that result before initiating another run.
