[1mdiff --git a/Makefile b/Makefile[m
[1mindex fdc3cc3..8082472 100644[m
[1m--- a/Makefile[m
[1m+++ b/Makefile[m
[36m@@ -1,17 +1,22 @@[m
 DIST_NAME = TODO-PACKAGE-NAME[m
 [m
 SCRIPT_FILES = \[m
[31m-	src/index.ts[m
[32m+[m	[32msrc/$(DIST_NAME).ts[m
 [m
 all: build lint test coverage esdoc[m
 [m
[31m-build: dist/$(DIST_NAME).js[m
[32m+[m[32mbuild: dist/$(DIST_NAME).js dist/$(DIST_NAME).d.ts[m
 .PHONY: build[m
 [m
[31m-demo: dist/$(DIST_NAME).js[m
[32m+[m[32mdemo: dist/$(DIST_NAME).js dist/$(DIST_NAME).d.ts[m
 	npm run demo[m
 .PHONY: demo[m
 [m
[32m+[m[32mdist/$(DIST_NAME).d.ts: dist/src/$(DIST_NAME).d.ts[m
[32m+[m	[32mmv $^ $@[m
[32m+[m
[32m+[m[32mdist/src/$(DIST_NAME).d.ts: dist/$(DIST_NAME).js[m
[32m+[m
 check:[m
 	npm run test[m
 .PHONY: check[m
[1mdiff --git a/package.json b/package.json[m
[1mindex 3d2e752..8f89753 100644[m
[1m--- a/package.json[m
[1m+++ b/package.json[m
[36m@@ -3,7 +3,7 @@[m
   "version": "1.4.0",[m
   "description": "TODO-PACKAGE-NAME",[m
   "main": "dist/TODO-PACKAGE-NAME.js",[m
[31m-  "types": "dist/src/index.d.ts",[m
[32m+[m[32m  "types": "dist/TODO-PACKAGE-NAME.d.ts",[m
   "scripts": {[m
     "coverage": "nyc npm run test",[m
     "test": "mocha -r @babel/register -r jsdom-global/register --recursive",[m
[1mdiff --git a/update-package-name.sh b/update-package-name.sh[m
[1mindex cf5332f..e7edad9 100755[m
[1m--- a/update-package-name.sh[m
[1m+++ b/update-package-name.sh[m
[36m@@ -13,4 +13,5 @@[m [mfi[m
 echo package name is $PACKAGE_NAME[m
 [m
 sed -i "s/microproject/$PACKAGE_NAME/g" .git/config[m
[32m+[m[32mmv src/index.ts src/$PACKAGE_NAME.ts[m
 git ls-files | xargs sed -i "s/TODO-PACKAGE-NAME/$PACKAGE_NAME/g" && echo Now run git rm -f $0 to remove this file.[m
