# microproject

This is for Node projects:

1. Copy latest existing microproject, or clone it from https://github.com/parsegraph/microproject

2. Edit package.json and change the following fields:
  - name of the package
  - description of the package
  - main JS output file
  - repository URL
  - bugs URL
  - homepage URL

3. Edit package-lock.json and change the name field to the name of the package.

4. Edit Makefile and change DIST_NAME to the name of the package, without parsegraph-.

5. Edit webpack.config.js and change the output filename and library to the name of the package, without parsegraph-.

6. Edit .github/workflows/node.js.yml build file and change the archive name to the name of the package.

7. Commit all changes

8. Implement src/index.ts

9. Implement test/test.ts

10. make clean

11. Run make and fix the build until it passes

12. Commit changes that you made to implement the package.

13. Edit README.md and change the title to the name of the package. Commit.

14. Edit .git/config and change the git remote URL.

15. Go to https://github.com/parsegraph/ and create a new repository using that name.

16. Push the repository to Github.

17. Await successful github build.

18. Retrieve artifact.

19. Unzip to tarball file in project directory

20. npm publish <tarball>
