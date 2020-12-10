# microproject

This is for Node projects:

## Setup

1. Pick a new package name.

2. Go to https://github.com/parsegraph/ and create a new repository using that name.

3. Clone latest microproject from https://github.com/parsegraph/microproject

4. Run ./update-package-name.sh with your package name:

<pre>
  # Set the package name to test
  ./update-package-name.sh test
</pre>

5. Commit (e.g. "Give package a name")

6. Push the repository to Github.

## Development

1. Implement src/index.ts

2. Implement test/test.ts

3. make clean

4. Run make and fix the build until it passes.

5. Commit (e.g. Implement library)

6. Update README.md.

7. Commit (e.g. Update documentation)

8. Push the repository to Github.

## Deployment

1. Await successful github build.

2. Retrieve artifact.

3. Unzip to tarball file in project directory

4. npm publish <tarball>
