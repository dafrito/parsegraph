// Publication operates on the archive produced and tested by CI. No build tools
// or project dependencies are installed in the privileged publication jobs.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const REPOSITORY = "dafrito/parsegraph";
const REGISTRY = "https://registry.npmjs.org";
const root = path.resolve(__dirname, "..");

function hash(bytes, algorithm = "sha256", encoding = "hex") {
  return createHash(algorithm).update(bytes).digest(encoding);
}

function validateReleaseContext(event, env, metadata, head, tagCommit) {
  assert.equal(
    env.GITHUB_ACTIONS,
    "true",
    "Publishing requires GitHub Actions"
  );
  assert.equal(
    env.GITHUB_EVENT_NAME,
    "release",
    "Only a release event can publish"
  );
  assert.equal(event.action, "published", "Release must have been published");
  assert.equal(env.GITHUB_REPOSITORY, REPOSITORY, "Unexpected repository");
  assert.equal(
    event.repository?.full_name,
    REPOSITORY,
    "Unexpected release repository"
  );
  assert.equal(event.release?.draft, false, "Draft releases cannot publish");
  assert.equal(
    event.release?.prerelease,
    false,
    "Prereleases are not supported yet"
  );
  assert.equal(metadata.name, "parsegraph", "Unexpected npm package");
  assert.match(
    metadata.version,
    /^7\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/,
    "Only stable 7.x releases are supported"
  );
  const tag = `v${metadata.version}`;
  assert.equal(
    event.release.tag_name,
    tag,
    "Release tag must match package.json version"
  );
  assert.equal(
    env.GITHUB_REF,
    `refs/tags/${tag}`,
    "Event ref must be the release tag"
  );
  assert.match(env.GITHUB_SHA, /^[a-f0-9]{40}$/, "Invalid release commit");
  assert.equal(head, env.GITHUB_SHA, "Checkout must be the released commit");
  assert.equal(
    tagCommit,
    head,
    "Release tag must resolve to the checked-out commit"
  );
  return tag;
}

function releaseContext(metadata) {
  const event = JSON.parse(
    fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")
  );
  const head = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim();
  // Validate the tag before it can be used as a Git revision or command argument.
  assert.match(
    event.release?.tag_name || "",
    /^v7\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
  );
  const tagCommit = execFileSync(
    "git",
    ["rev-parse", `refs/tags/${event.release.tag_name}^{commit}`],
    {
      cwd: root,
      encoding: "utf8",
    }
  ).trim();
  const tag = validateReleaseContext(
    event,
    process.env,
    metadata,
    head,
    tagCommit
  );
  return { event, tag };
}

function validateRecoveryContext(event, env, metadata, facts) {
  assert.equal(env.GITHUB_ACTIONS, "true", "Recovery requires GitHub Actions");
  assert.equal(env.GITHUB_EVENT_NAME, "workflow_dispatch");
  assert.equal(env.GITHUB_REPOSITORY, REPOSITORY, "Unexpected repository");
  assert.equal(event.repository?.full_name, REPOSITORY);
  assert.equal(env.GITHUB_REF, "refs/heads/main", "Recovery must run on main");
  assert.equal(metadata.name, "parsegraph");
  assert.match(metadata.version, /^7\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  const tag = `v${metadata.version}`;
  assert.equal(
    event.inputs?.release_tag,
    tag,
    "Recovery tag must match package.json"
  );
  assert.match(
    event.inputs?.release_commit || "",
    /^[a-f0-9]{40}$/,
    "Expected original release commit"
  );
  assert.match(env.GITHUB_SHA, /^[a-f0-9]{40}$/);
  assert.equal(
    facts.head,
    env.GITHUB_SHA,
    "Checkout must be the workflow source"
  );
  assert.equal(
    facts.tagCommit,
    event.inputs.release_commit,
    "Release tag moved from its expected commit"
  );
  assert.equal(
    facts.isAncestor,
    true,
    "Original release must be an ancestor of recovery source"
  );
  assert.equal(facts.tagMetadata.name, metadata.name);
  assert.equal(
    facts.tagMetadata.version,
    metadata.version,
    "Original release version differs"
  );
  assert.equal(facts.release.tagName, tag);
  assert.equal(
    facts.release.isDraft,
    false,
    "Recovery requires a published release"
  );
  assert.equal(
    facts.release.isPrerelease,
    false,
    "Recovery requires a stable release"
  );
  assert.ok(
    typeof facts.release.publishedAt === "string" &&
      Number.isFinite(Date.parse(facts.release.publishedAt)),
    "Recovery requires a publication date"
  );
  return tag;
}

function recoveryContext(metadata) {
  const event = JSON.parse(
    fs.readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")
  );
  // Validate inputs before using them as revisions or CLI arguments.
  assert.match(
    event.inputs?.release_tag || "",
    /^v7\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/
  );
  assert.match(event.inputs?.release_commit || "", /^[a-f0-9]{40}$/);
  const git = (args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  const head = git(["rev-parse", "HEAD"]);
  const tagCommit = git([
    "rev-parse",
    `refs/tags/${event.inputs.release_tag}^{commit}`,
  ]);
  let isAncestor = false;
  try {
    git(["merge-base", "--is-ancestor", tagCommit, head]);
    isAncestor = true;
  } catch {
    // An unknown or unrelated release source cannot authorize publication.
  }
  const release = JSON.parse(
    execFileSync(
      "gh",
      [
        "release",
        "view",
        event.inputs.release_tag,
        "--repo",
        REPOSITORY,
        "--json",
        "tagName,isDraft,isPrerelease,publishedAt",
      ],
      { cwd: root, encoding: "utf8", timeout: 30000 }
    )
  );
  const tag = validateRecoveryContext(event, process.env, metadata, {
    head,
    tagCommit,
    isAncestor,
    release,
    tagMetadata: JSON.parse(git(["show", `${tagCommit}:package.json`])),
  });
  console.log(
    `Recovery source ${head}; immutable ${tag} source ${tagCommit}. Publication requires byte-identical archives.`
  );
  return { event, tag, recovery: true };
}

function publicationContext(metadata) {
  return process.env.GITHUB_EVENT_NAME === "workflow_dispatch"
    ? recoveryContext(metadata)
    : releaseContext(metadata);
}

function readCandidate(directory, metadata) {
  const receipt = JSON.parse(
    fs.readFileSync(path.join(directory, "release-package.json"), "utf8")
  );
  assert.equal(receipt.name, "parsegraph", "Unexpected artifact package");
  assert.equal(
    receipt.version,
    metadata.version,
    "Artifact version does not match source"
  );
  assert.match(receipt.version, /^7\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/);
  assert.equal(
    receipt.filename,
    `parsegraph-${receipt.version}.tgz`,
    "Unexpected archive path"
  );
  const archive = path.join(directory, receipt.filename);
  const bytes = fs.readFileSync(archive);
  assert.equal(
    receipt.integrity,
    `sha512-${hash(bytes, "sha512", "base64")}`,
    "Archive integrity mismatch"
  );
  assert.equal(receipt.shasum, hash(bytes, "sha1"), "Archive shasum mismatch");
  assert.equal(receipt.sha256, hash(bytes), "Archive SHA256 mismatch");
  return { receipt, archive };
}

function assetNames(receipt) {
  return [
    receipt.filename,
    `parsegraph-docs-${receipt.version}.tgz`,
    "release-package.json",
  ];
}

function checksums(directory, receipt) {
  return assetNames(receipt)
    .map(
      (name) =>
        `${hash(fs.readFileSync(path.join(directory, name)))}  ${name}\n`
    )
    .join("");
}

function verifyAssets(directory, metadata) {
  const candidate = readCandidate(directory, metadata);
  assert.equal(
    fs.readFileSync(path.join(directory, "SHA256SUMS"), "utf8"),
    checksums(directory, candidate.receipt),
    "Release asset checksums changed"
  );
  return candidate;
}

function compareRecoveryAssets(directory, originalDirectory, metadata) {
  const candidate = verifyAssets(directory, metadata);
  const original = verifyAssets(originalDirectory, metadata);
  assert.ok(
    fs
      .readFileSync(candidate.archive)
      .equals(fs.readFileSync(original.archive)),
    "Recovery archive differs from the original published release"
  );
  assert.ok(
    fs
      .readFileSync(path.join(directory, "release-package.json"))
      .equals(
        fs.readFileSync(path.join(originalDirectory, "release-package.json"))
      ),
    "Recovery receipt differs from the original published release"
  );
  return candidate;
}

function verifyRecoveryAssets(directory, metadata, tag, run = execFileSync) {
  const candidate = verifyAssets(directory, metadata);
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "parsegraph-recovery-")
  );
  try {
    for (const name of [...assetNames(candidate.receipt), "SHA256SUMS"]) {
      run(
        "gh",
        [
          "release",
          "download",
          tag,
          "--repo",
          REPOSITORY,
          "--pattern",
          name,
          "--dir",
          temporary,
        ],
        { stdio: "inherit", timeout: 60000 }
      );
    }
    compareRecoveryAssets(directory, temporary, metadata);
    console.log(
      `Recovery verified: ${candidate.receipt.filename} and its receipt exactly match ${tag}; original release assets remain unchanged.`
    );
    return candidate;
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

function publicationAction(receipt, published) {
  if (published === null) return "publish";
  assert.equal(
    published.name,
    receipt.name,
    "Registry returned a different package"
  );
  assert.equal(
    published.version,
    receipt.version,
    "Registry returned a different version"
  );
  assert.equal(
    published.dist?.integrity,
    receipt.integrity,
    "This version already exists with different archive integrity; never overwrite or retag it"
  );
  assert.equal(
    published.dist?.shasum,
    receipt.shasum,
    "This version already exists with a different archive shasum"
  );
  return "already-published";
}

function validateNpmVersion(version) {
  assert.match(version, /^\d+\.\d+\.\d+$/);
  const [major, minor, patch] = version.split(".").map(Number);
  assert.ok(
    major > 11 || (major === 11 && (minor > 5 || (minor === 5 && patch >= 1))),
    "Trusted publishing requires npm >= 11.5.1"
  );
}

async function lookupPublished(receipt, run = execFileSync) {
  // Use the same registry transport/configuration as publication. Built-in
  // fetch timed out on hosted runners where npm's registry requests succeeded.
  let output;
  try {
    output = run(
      "npm",
      [
        "view",
        `${receipt.name}@${receipt.version}`,
        "name",
        "version",
        "dist",
        "--json",
        `--registry=${REGISTRY}`,
        "--prefer-online",
        "--fetch-retries=2",
        "--fetch-retry-mintimeout=1000",
        "--fetch-retry-maxtimeout=3000",
        "--fetch-timeout=15000",
      ],
      {
        cwd: root,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: 60000,
      }
    );
  } catch (error) {
    let code;
    try {
      code = JSON.parse(String(error.stdout)).error?.code;
    } catch {
      // A missing/malformed response cannot establish that a version is absent.
    }
    if (error.status === 1 && !error.signal && code === "E404") return null;
    throw new Error(
      `Registry lookup failed (${
        code || error.code || error.signal || "unknown error"
      }); refusing to assume the version is absent`
    );
  }
  const published = JSON.parse(output);
  assert.equal(
    published?.name,
    receipt.name,
    "Registry returned a different package"
  );
  assert.equal(
    published?.version,
    receipt.version,
    "Registry returned a different version"
  );
  return published;
}

async function publishCandidate(
  candidate,
  lookup = lookupPublished,
  run = execFileSync
) {
  const action = publicationAction(
    candidate.receipt,
    await lookup(candidate.receipt)
  );
  if (action === "already-published") {
    console.log(
      `Registry already contains exactly ${candidate.receipt.filename}; no publication or dist-tag changes needed.`
    );
    return action;
  }
  try {
    run(
      "npm",
      [
        "publish",
        candidate.archive,
        "--ignore-scripts",
        "--access=public",
        "--tag=latest",
        "--provenance",
        `--registry=${REGISTRY}`,
        "--fetch-timeout=60000",
        "--fetch-retries=0",
        "--loglevel=http",
      ],
      { cwd: root, stdio: "inherit", timeout: 180000, killSignal: "SIGKILL" }
    );
  } catch (error) {
    // A timeout can lose the response after the registry accepted the bytes.
    // Read once to establish the outcome; never blindly repeat a publication.
    const afterFailure = await lookup(candidate.receipt);
    if (
      publicationAction(candidate.receipt, afterFailure) === "already-published"
    ) {
      console.log(
        `Publication response failed, but registry integrity confirms ${candidate.receipt.filename}.`
      );
      return "already-published";
    }
    throw error;
  }
  return action;
}

function attachAssets(directory, receipt, tag, run = execFileSync) {
  const remote = JSON.parse(
    run(
      "gh",
      [
        "release",
        "view",
        tag,
        "--repo",
        REPOSITORY,
        "--json",
        "assets,isDraft,isPrerelease,tagName",
      ],
      { encoding: "utf8" }
    )
  );
  assert.equal(remote.tagName, tag);
  assert.equal(remote.isDraft, false);
  assert.equal(remote.isPrerelease, false);
  const temporary = fs.mkdtempSync(
    path.join(os.tmpdir(), "parsegraph-release-assets-")
  );
  try {
    const missing = [];
    for (const name of [...assetNames(receipt), "SHA256SUMS"]) {
      const filename = path.join(directory, name);
      if (remote.assets.some((asset) => asset.name === name)) {
        run(
          "gh",
          [
            "release",
            "download",
            tag,
            "--repo",
            REPOSITORY,
            "--pattern",
            name,
            "--dir",
            temporary,
          ],
          { stdio: "inherit" }
        );
        assert.equal(
          hash(fs.readFileSync(path.join(temporary, name))),
          hash(fs.readFileSync(filename)),
          `Existing release asset ${name} differs; refusing to replace it`
        );
        console.log(`Verified existing release asset ${name}`);
      } else {
        missing.push(filename);
      }
    }
    // Check every existing asset before uploading any missing ones. A conflict
    // late in the list must not leave a release partly populated by a retry.
    for (const filename of missing)
      run("gh", ["release", "upload", tag, filename, "--repo", REPOSITORY], {
        stdio: "inherit",
      });
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

async function main(command) {
  const metadata = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  );
  const directory = path.join(root, "generated");
  if (command === "check-registry") {
    assert.ok(
      await lookupPublished({ name: "parsegraph", version: "6.2.0" }),
      "Known published version is missing"
    );
    const published = await lookupPublished(metadata);
    console.log(
      `npm registry lookup verified: 6.2.0 exists; ${metadata.version} is ${
        published ? "published" : "unpublished"
      }`
    );
  } else if (command === "guard") {
    const { tag } = publicationContext(metadata);
    console.log(`Verified ${tag} at ${process.env.GITHUB_SHA}`);
  } else if (command === "seal") {
    const { receipt } = readCandidate(directory, metadata);
    fs.writeFileSync(
      path.join(directory, "SHA256SUMS"),
      checksums(directory, receipt)
    );
    console.log(`Sealed ${receipt.filename}, versioned API docs, and receipt`);
  } else if (command === "verify") {
    const { receipt } = verifyAssets(directory, metadata);
    console.log(
      `Verified release assets for ${receipt.name}@${receipt.version}`
    );
  } else if (command === "publish" || command === "attach") {
    const { tag, recovery } = publicationContext(metadata);
    assert.ok(
      command !== "attach" || !recovery,
      "Recovery must not replace release assets"
    );
    const candidate = recovery
      ? verifyRecoveryAssets(directory, metadata, tag)
      : verifyAssets(directory, metadata);
    if (command === "publish") {
      validateNpmVersion(
        execFileSync("npm", ["--version"], { encoding: "utf8" }).trim()
      );
      await publishCandidate(candidate);
    } else {
      attachAssets(directory, candidate.receipt, tag);
    }
  } else {
    throw new Error(
      "Usage: node tools/release.cjs <check-registry|guard|seal|verify|publish|attach>"
    );
  }
}

module.exports = {
  hash,
  validateReleaseContext,
  validateRecoveryContext,
  readCandidate,
  assetNames,
  checksums,
  verifyAssets,
  compareRecoveryAssets,
  verifyRecoveryAssets,
  publicationAction,
  validateNpmVersion,
  lookupPublished,
  publishCandidate,
  attachAssets,
};

if (require.main === module)
  main(process.argv[2]).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
