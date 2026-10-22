console.error(
  "Do not pack or publish the repository root: it contains development outputs.\n" +
    "Run yarn pack:release for a verified production archive, or yarn pack:preview\n" +
    "for a private preview. Publish the verified release archive through the release workflow."
);
process.exitCode = 1;
