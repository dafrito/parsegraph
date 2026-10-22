const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  hash,
  validateReleaseContext,
  readCandidate,
  checksums,
  verifyAssets,
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
  assert.equal(
    await lookupPublished(metadata, async () => ({ status: 404 })),
    null
  );
  for (const status of [401, 403, 429, 500, 503]) {
    await assert.rejects(
      lookupPublished(metadata, async () => ({ status, ok: false })),
      /refusing to assume/
    );
  }
  await assert.rejects(
    lookupPublished(metadata, async () => {
      throw new Error("network unavailable");
    }),
    /network unavailable/
  );
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
  ]);
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
