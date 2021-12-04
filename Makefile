DIST_NAME = layout

SCRIPT_FILES = \
	src/index.ts \
	src/BaseCommitLayoutData.ts \
	src/Positioned.ts \
	src/BasicPositioned.ts \
	src/Layout.ts \
	src/CommitLayoutData.ts \
	src/Exception.ts \
	src/LayoutCaret.ts \
	src/LayoutNode.ts \
	src/LayoutNodePalette.ts \
	src/autocommit.ts \
	src/checkExtentsEqual.ts

all: build lint test coverage esdoc

build: dist/parsegraph-$(DIST_NAME).js
.PHONY: build

build-prod: dist-prod/parsegraph-$(DIST_NAME).js
.PHONY: build-prod

demo: dist/$(DIST_NAME).js
	npm run demo
.PHONY: demo

check:
	npm run test
.PHONY: check

test: check
.PHONY: test

coverage:
	npm run coverage
.PHONY: coverage

prettier:
	npx prettier --write src test demo
.PHONY: prettier

lint:
	npx eslint --fix $(SCRIPT_FILES)
.PHONY: lint

esdoc:
	npx esdoc
.PHONY: esdoc

doc: esdoc
.PHONY: doc

dist/parsegraph-$(DIST_NAME).js: package.json package-lock.json $(SCRIPT_FILES)
	npm run build
	mv -v dist-types/src/* dist/
	mv dist/index.d.ts dist/parsegraph-$(DIST_NAME).d.ts
	mv dist/index.d.ts.map dist/parsegraph-$(DIST_NAME).d.ts.map

dist-prod/parsegraph-$(DIST_NAME).js: package.json package-lock.json $(SCRIPT_FILES)
	npm run build-prod
	mv -v dist-types/src/* dist-prod/
	mv dist-prod/index.d.ts dist-prod/parsegraph-$(DIST_NAME).d.ts
	mv dist-prod/index.d.ts.map dist-prod/parsegraph-$(DIST_NAME).d.ts.map

tar: parsegraph-$(DIST_NAME)-dev.tgz
.PHONY: tar

tar-prod: parsegraph-$(DIST_NAME)-prod.tgz
.PHONY: tar

parsegraph-$(DIST_NAME)-prod.tgz: dist-prod/parsegraph-$(DIST_NAME).js
	rm -rf parsegraph-$(DIST_NAME)
	mkdir parsegraph-$(DIST_NAME)
	cp -r README.md LICENSE parsegraph-$(DIST_NAME)
	cp -r dist-prod/ parsegraph-$(DIST_NAME)/dist
	cp -r package-prod.json parsegraph-$(DIST_NAME)/package.json
	tar cvzf $@ parsegraph-$(DIST_NAME)/
	rm -rf parsegraph-$(DIST_NAME)

parsegraph-$(DIST_NAME)-dev.tgz: dist/parsegraph-$(DIST_NAME).js
	rm -rf parsegraph-$(DIST_NAME)
	mkdir parsegraph-$(DIST_NAME)
	cp -r package.json package-lock.json README.md demo/ LICENSE dist/ parsegraph-$(DIST_NAME)
	tar cvzf $@ parsegraph-$(DIST_NAME)/
	rm -rf parsegraph-$(DIST_NAME)

clean:
	rm -rf dist dist-prod dist-types .nyc_output parsegraph-$(DIST_NAME)-dev.tgz parsegraph-$(DIST_NAME)-prod.tgz
	rm -rf parsegraph-$(DIST_NAME)
.PHONY: clean
