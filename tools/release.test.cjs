const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  hash,
  validateReleaseContext,
  validateRecoveryContext,
  readCandidate,
  checksums,
  verifyAssets,
  compareRecoveryAssets,
  verifyRecoveryAssets,
  publicationAction,
  validateNpmVersion,
  lookupPublished,
  publishCandidate,
  attachAssets,
} = require("./release.cjs");

const metadata = { name: "parsegraph", version: "7.0.0" };
const sha = "1234567890abcdef1234567890abcdef12345678";
function context() {
  return [
    {
      action: "published",
      repository: { full_name: "dafrito/parsegraph" },
      release: { tag_name: "v7.0.0", draft: false, prerelease: false },
    },
    {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "release",
      GITHUB_REPOSITORY: "dafrito/parsegraph",
      GITHUB_SHA: sha,
      GITHUB_REF: "refs/tags/v7.0.0",
    },
    { ...metadata },
    sha,
    sha,
  ];
}

test("release identity accepts the stable matching version and resolved tag", () => {
  assert.equal(validateReleaseContext(...context()), "v7.0.0");
});

function recoveryContext() {
  return [
    {
      repository: { full_name: "dafrito/parsegraph" },
      inputs: { release_tag: "v7.0.0", release_commit: sha },
    },
    {
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "workflow_dispatch",
      GITHUB_REPOSITORY: "dafrito/parsegraph",
      GITHUB_SHA: "b".repeat(40),
      GITHUB_REF: "refs/heads/main",
    },
    { ...metadata },
    {
      head: "b".repeat(40),
      tagCommit: sha,
      isAncestor: true,
      tagMetadata: { ...metadata },
      release: {
        tagName: "v7.0.0",
        isDraft: false,
        isPrerelease: false,
        publishedAt: "2026-10-22T02:25:30Z",
      },
    },
  ];
}

test("recovery accepts a published ancestor release while retaining actual workflow identity", () => {
  const c = recoveryContext();
  const before = JSON.stringify(c);
  assert.equal(validateRecoveryContext(...c), "v7.0.0");
  assert.equal(
    JSON.stringify(c),
    before,
    "Must not rewrite provenance environment"
  );
  assert.notEqual(c[1].GITHUB_SHA, c[3].tagCommit);
});

for (const [name, mutate] of [
  [
    "local invocation",
    (c) => {
      delete c[1].GITHUB_ACTIONS;
    },
  ],
  [
    "push",
    (c) => {
      c[1].GITHUB_EVENT_NAME = "push";
    },
  ],
  [
    "fork",
    (c) => {
      c[1].GITHUB_REPOSITORY = "other/parsegraph";
    },
  ],
  [
    "foreign event",
    (c) => {
      c[0].repository.full_name = "other/parsegraph";
    },
  ],
  [
    "tag dispatch",
    (c) => {
      c[1].GITHUB_REF = "refs/tags/v7.0.0";
    },
  ],
  [
    "another branch",
    (c) => {
      c[1].GITHUB_REF = "refs/heads/topic";
    },
  ],
  [
    "different checkout",
    (c) => {
      c[3].head = sha;
    },
  ],
  [
    "wrong package",
    (c) => {
      c[2].name = "other";
    },
  ],
  [
    "prerelease package",
    (c) => {
      c[2].version = "7.0.0-rc.1";
    },
  ],
  [
    "different version",
    (c) => {
      c[0].inputs.release_tag = "v7.0.1";
    },
  ],
  [
    "missing expected commit",
    (c) => {
      delete c[0].inputs.release_commit;
    },
  ],
  [
    "moved tag",
    (c) => {
      c[3].tagCommit = "a".repeat(40);
    },
  ],
  [
    "unrelated source",
    (c) => {
      c[3].isAncestor = false;
    },
  ],
  [
    "original version mismatch",
    (c) => {
      c[3].tagMetadata.version = "6.2.0";
    },
  ],
  [
    "wrong release",
    (c) => {
      c[3].release.tagName = "v7.0.1";
    },
  ],
  [
    "draft release",
    (c) => {
      c[3].release.isDraft = true;
    },
  ],
  [
    "prerelease",
    (c) => {
      c[3].release.isPrerelease = true;
    },
  ],
  [
    "unpublished release",
    (c) => {
      c[3].release.publishedAt = null;
    },
  ],
]) {
  test(`recovery rejects ${name}`, () => {
    const c = recoveryContext();
    mutate(c);
    assert.throws(() => validateRecoveryContext(...c));
  });
}

for (const [name, mutate] of [
  [
    "manual dispatch",
    (c) => {
      c[1].GITHUB_EVENT_NAME = "workflow_dispatch";
    },
  ],
  [
    "push",
    (c) => {
      c[1].GITHUB_EVENT_NAME = "push";
    },
  ],
  [
    "local invocation",
    (c) => {
      delete c[1].GITHUB_ACTIONS;
    },
  ],
  [
    "edited release",
    (c) => {
      c[0].action = "edited";
    },
  ],
  [
    "draft",
    (c) => {
      c[0].release.draft = true;
    },
  ],
  [
    "prerelease",
    (c) => {
      c[0].release.prerelease = true;
    },
  ],
  [
    "different tag",
    (c) => {
      c[0].release.tag_name = "v7.0.1";
    },
  ],
  [
    "different ref",
    (c) => {
      c[1].GITHUB_REF = "refs/heads/main";
    },
  ],
  [
    "different checkout",
    (c) => {
      c[3] = "a".repeat(40);
    },
  ],
  [
    "moved tag",
    (c) => {
      c[4] = "a".repeat(40);
    },
  ],
  [
    "forked repository",
    (c) => {
      c[1].GITHUB_REPOSITORY = "someone/parsegraph";
    },
  ],
  [
    "mismatched payload repository",
    (c) => {
      c[0].repository.full_name = "someone/parsegraph";
    },
  ],
  [
    "prerelease version",
    (c) => {
      c[2].version = "7.0.0-rc.1";
    },
  ],
  [
    "unreviewed next major",
    (c) => {
      c[2].version = "8.0.0";
    },
  ],
  [
    "leading-zero version",
    (c) => {
      c[2].version = "7.00.0";
    },
  ],
]) {
  test(`release identity rejects ${name}`, () => {
    const c = context();
    mutate(c);
    assert.throws(() => validateReleaseContext(...c));
  });
}

function fixture(t) {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "parsegraph-release-test-")
  );
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const bytes = Buffer.from("already verified npm archive");
  const receipt = {
    ...metadata,
    filename: "parsegraph-7.0.0.tgz",
    integrity: `sha512-${hash(bytes, "sha512", "base64")}`,
    shasum: hash(bytes, "sha1"),
    sha256: hash(bytes),
  };
  fs.writeFileSync(path.join(directory, receipt.filename), bytes);
  fs.writeFileSync(
    path.join(directory, "parsegraph-docs-7.0.0.tgz"),
    "versioned documentation"
  );
  fs.writeFileSync(
    path.join(directory, "release-package.json"),
    JSON.stringify(receipt)
  );
  fs.writeFileSync(
    path.join(directory, "SHA256SUMS"),
    checksums(directory, receipt)
  );
  return {
    directory,
    receipt,
    archive: path.join(directory, receipt.filename),
  };
}

test("downloaded artifacts retain their validated hashes", (t) => {
  const { directory, receipt } = fixture(t);
  assert.deepEqual(verifyAssets(directory, metadata).receipt, receipt);
});

test("recovery compares npm bytes and receipt while verifying each independent documentation seal", (t) => {
  const current = fixture(t);
  const original = fixture(t);
  fs.writeFileSync(
    path.join(current.directory, "parsegraph-docs-7.0.0.tgz"),
    "newly generated documentation archive"
  );
  fs.writeFileSync(
    path.join(current.directory, "SHA256SUMS"),
    checksums(current.directory, current.receipt)
  );
  assert.equal(
    compareRecoveryAssets(current.directory, original.directory, metadata)
      .archive,
    current.archive
  );
});

test("recovery rejects a different but independently valid npm archive", (t) => {
  const current = fixture(t);
  const original = fixture(t);
  const bytes = Buffer.from("a different valid candidate");
  fs.writeFileSync(current.archive, bytes);
  Object.assign(current.receipt, {
    integrity: `sha512-${hash(bytes, "sha512", "base64")}`,
    shasum: hash(bytes, "sha1"),
    sha256: hash(bytes),
  });
  fs.writeFileSync(
    path.join(current.directory, "release-package.json"),
    JSON.stringify(current.receipt)
  );
  fs.writeFileSync(
    path.join(current.directory, "SHA256SUMS"),
    checksums(current.directory, current.receipt)
  );
  assert.throws(
    () =>
      compareRecoveryAssets(current.directory, original.directory, metadata),
    /differs from the original/
  );
});

test("recovery rejects corrupt original assets and changed receipt bytes", (t) => {
  const current = fixture(t);
  const original = fixture(t);
  fs.appendFileSync(
    path.join(original.directory, "release-package.json"),
    "\n"
  );
  assert.throws(
    () =>
      compareRecoveryAssets(current.directory, original.directory, metadata),
    /checksums changed/
  );
  fs.writeFileSync(
    path.join(original.directory, "SHA256SUMS"),
    checksums(original.directory, original.receipt)
  );
  assert.throws(
    () =>
      compareRecoveryAssets(current.directory, original.directory, metadata),
    /Recovery receipt differs/
  );
});

test("recovery only downloads and verifies existing release assets", (t) => {
  const current = fixture(t);
  const original = fixture(t);
  const downloaded = [];
  const candidate = verifyRecoveryAssets(
    current.directory,
    metadata,
    "v7.0.0",
    (program, args, options) => {
      assert.equal(program, "gh");
      assert.deepEqual(args.slice(0, 3), ["release", "download", "v7.0.0"]);
      assert.equal(options.timeout, 60000);
      const name = args[args.indexOf("--pattern") + 1];
      const destination = args[args.indexOf("--dir") + 1];
      downloaded.push(name);
      fs.copyFileSync(
        path.join(original.directory, name),
        path.join(destination, name)
      );
    }
  );
  assert.equal(candidate.archive, current.archive);
  assert.deepEqual(downloaded, [
    current.receipt.filename,
    "parsegraph-docs-7.0.0.tgz",
    "release-package.json",
    "SHA256SUMS",
  ]);
});

test("modified npm archive fails verification even with a matching filename", (t) => {
  const { directory, archive } = fixture(t);
  fs.appendFileSync(archive, "changed");
  assert.throws(() => verifyAssets(directory, metadata), /integrity mismatch/);
});

test("modified documentation fails checksum verification", (t) => {
  const { directory } = fixture(t);
  fs.appendFileSync(
    path.join(directory, "parsegraph-docs-7.0.0.tgz"),
    "changed"
  );
  assert.throws(() => verifyAssets(directory, metadata), /checksums changed/);
});

test("receipt paths cannot escape the downloaded artifact directory", (t) => {
  const { directory, receipt } = fixture(t);
  receipt.filename = "../parsegraph-7.0.0.tgz";
  fs.writeFileSync(
    path.join(directory, "release-package.json"),
    JSON.stringify(receipt)
  );
  assert.throws(
    () => readCandidate(directory, metadata),
    /Unexpected archive path/
  );
});

test("release refuses a candidate built for another version", (t) => {
  const { directory } = fixture(t);
  assert.throws(
    () => readCandidate(directory, { ...metadata, version: "7.0.1" }),
    /version does not match/
  );
});

test("registry absence is distinct from authentication, rate limit, or server failure", async () => {
  const failure =
    (code, overrides = {}) =>
    () => {
      throw Object.assign(new Error("npm view failed"), {
        status: 1,
        signal: null,
        stdout: JSON.stringify({ error: { code } }),
        ...overrides,
      });
    };
  assert.equal(await lookupPublished(metadata, failure("E404")), null);
  for (const code of [
    "E401",
    "E403",
    "E429",
    "E500",
    "E503",
    "EAI_AGAIN",
    "ETIMEDOUT",
  ]) {
    await assert.rejects(
      lookupPublished(metadata, failure(code)),
      /refusing to assume/
    );
  }
  for (const overrides of [
    { status: null, signal: "SIGTERM" },
    { status: 2 },
    { stdout: "not JSON" },
    { stdout: "" },
  ]) {
    await assert.rejects(
      lookupPublished(metadata, failure("E404", overrides)),
      /refusing to assume/
    );
  }
});

test("registry lookup uses bounded npm requests and returns exact version metadata", async () => {
  const published = { ...metadata, dist: { integrity: "sha512-example" } };
  assert.deepEqual(
    await lookupPublished(metadata, (program, args, options) => {
      assert.equal(program, "npm");
      assert.deepEqual(args.slice(0, 6), [
        "view",
        "parsegraph@7.0.0",
        "name",
        "version",
        "dist",
        "--json",
      ]);
      assert.ok(args.includes("--registry=https://registry.npmjs.org"));
      assert.ok(args.includes("--prefer-online"));
      assert.ok(args.includes("--fetch-timeout=15000"));
      assert.equal(options.timeout, 60000);
      return JSON.stringify(published);
    }),
    published
  );
});

test("successful but malformed or mismatched registry output cannot permit publication", async () => {
  for (const output of [
    "",
    "invalid JSON",
    "null",
    "[]",
    "{}",
    JSON.stringify({ ...metadata, version: "6.2.0" }),
  ]) {
    await assert.rejects(lookupPublished(metadata, () => output));
  }
});

test("publication retry skips only byte-identical immutable npm versions", async (t) => {
  const candidate = fixture(t);
  const published = {
    ...metadata,
    dist: {
      integrity: candidate.receipt.integrity,
      shasum: candidate.receipt.shasum,
    },
  };
  assert.equal(publicationAction(candidate.receipt, null), "publish");
  assert.equal(
    await publishCandidate(
      candidate,
      async () => published,
      () => assert.fail("must not publish twice")
    ),
    "already-published"
  );
  await assert.rejects(
    publishCandidate(
      candidate,
      async () => ({
        ...published,
        dist: { ...published.dist, integrity: "sha512-different" },
      }),
      () => assert.fail("must not overwrite")
    ),
    /already exists with different/
  );
});

test("first publication sends the exact verified archive without rebuilding or scripts", async (t) => {
  const candidate = fixture(t);
  const calls = [];
  assert.equal(
    await publishCandidate(
      candidate,
      async () => null,
      (...args) => calls.push(args)
    ),
    "publish"
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "npm");
  assert.deepEqual(calls[0][1], [
    "publish",
    candidate.archive,
    "--ignore-scripts",
    "--access=public",
    "--tag=latest",
    "--provenance",
    "--registry=https://registry.npmjs.org",
    "--fetch-timeout=60000",
    "--fetch-retries=0",
    "--loglevel=http",
  ]);
  assert.equal(calls[0][2].timeout, 180000);
  assert.equal(calls[0][2].killSignal, "SIGKILL");
});

test("failed npm publication is surfaced for a deliberate retry", async (t) => {
  const candidate = fixture(t);
  let calls = 0;
  await assert.rejects(
    publishCandidate(
      candidate,
      async () => null,
      () => {
        calls++;
        throw new Error("npm rejected publication");
      }
    ),
    /npm rejected/
  );
  assert.equal(calls, 1);
});

test("a lost publication response is recovered only by matching registry integrity", async (t) => {
  const candidate = fixture(t);
  let lookups = 0;
  let uploads = 0;
  assert.equal(
    await publishCandidate(
      candidate,
      async () => {
        if (++lookups === 1) return null;
        return {
          ...metadata,
          dist: {
            integrity: candidate.receipt.integrity,
            shasum: candidate.receipt.shasum,
          },
        };
      },
      () => {
        uploads++;
        throw Object.assign(new Error("publish timed out"), {
          code: "ETIMEDOUT",
        });
      }
    ),
    "already-published"
  );
  assert.equal(lookups, 2);
  assert.equal(uploads, 1);
});

test("ambiguous failure rejects registry conflicts and unreadable outcomes without retransmission", async (t) => {
  const candidate = fixture(t);
  for (const after of [
    async () => ({
      ...metadata,
      dist: {
        integrity: "sha512-conflicting",
        shasum: candidate.receipt.shasum,
      },
    }),
    async () => {
      throw new Error("Registry lookup failed");
    },
  ]) {
    let lookups = 0;
    let uploads = 0;
    await assert.rejects(
      publishCandidate(
        candidate,
        async () => (++lookups === 1 ? null : after()),
        () => {
          uploads++;
          throw new Error("upload response lost");
        }
      ),
      /different archive integrity|Registry lookup failed/
    );
    assert.equal(lookups, 2);
    assert.equal(uploads, 1);
  }
});

test("npm's trusted publisher minimum is checked explicitly", () => {
  for (const version of ["11.5.1", "11.16.0", "12.0.0"])
    validateNpmVersion(version);
  for (const version of ["10.9.3", "11.4.9", "11.5.0", "11.5.1-beta.0"])
    assert.throws(() => validateNpmVersion(version));
});

test("attachments can retry without npm and upload only missing identical assets", (t) => {
  const { directory, receipt } = fixture(t);
  const uploaded = [];
  attachAssets(directory, receipt, "v7.0.0", (program, args) => {
    assert.equal(program, "gh");
    if (args[1] === "view")
      return JSON.stringify({
        tagName: "v7.0.0",
        isDraft: false,
        isPrerelease: false,
        assets: [{ name: receipt.filename }],
      });
    if (args[1] === "download") {
      const target = args[args.indexOf("--dir") + 1];
      fs.copyFileSync(
        path.join(directory, receipt.filename),
        path.join(target, receipt.filename)
      );
    } else if (args[1] === "upload") uploaded.push(path.basename(args[3]));
    else assert.fail(`Unexpected command: ${args.join(" ")}`);
  });
  assert.deepEqual(uploaded, [
    "parsegraph-docs-7.0.0.tgz",
    "release-package.json",
    "SHA256SUMS",
  ]);
});

test("attachment retries refuse to replace conflicting published bytes", (t) => {
  const { directory, receipt } = fixture(t);
  assert.throws(
    () =>
      attachAssets(directory, receipt, "v7.0.0", (program, args) => {
        if (args[1] === "view")
          return JSON.stringify({
            tagName: "v7.0.0",
            isDraft: false,
            isPrerelease: false,
            assets: [{ name: receipt.filename }],
          });
        if (args[1] === "download") {
          fs.writeFileSync(
            path.join(args[args.indexOf("--dir") + 1], receipt.filename),
            "previously attached different bytes"
          );
          return;
        }
        assert.fail("Must not overwrite an existing asset");
      }),
    /refusing to replace/
  );
});

test("an attachment conflict is detected before any missing files are uploaded", (t) => {
  const { directory, receipt } = fixture(t);
  assert.throws(
    () =>
      attachAssets(directory, receipt, "v7.0.0", (program, args) => {
        if (args[1] === "view")
          return JSON.stringify({
            tagName: "v7.0.0",
            isDraft: false,
            isPrerelease: false,
            assets: [{ name: "SHA256SUMS" }],
          });
        if (args[1] === "download") {
          fs.writeFileSync(
            path.join(args[args.indexOf("--dir") + 1], "SHA256SUMS"),
            "conflicting previous checksums"
          );
          return;
        }
        assert.fail("Must validate existing assets before uploading any files");
      }),
    /refusing to replace/
  );
});
