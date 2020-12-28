DIST_NAME = TODO-PACKAGE-NAME

SCRIPT_FILES = \
	src/$(DIST_NAME).ts

DECLARATION_FILES = \
	dist/$(DIST_NAME).d.ts \
	dist/$(DIST_NAME).d.ts.map

all: build lint test coverage esdoc

build: dist/$(DIST_NAME).js $(DECLARATION_FILES)
.PHONY: build

demo: dist/$(DIST_NAME).js $(DECLARATION_FILES)
	npm run demo
.PHONY: demo

dist/$(DIST_NAME).d.ts: dist/src/$(DIST_NAME).d.ts
	mv $^ $@

dist/$(DIST_NAME).d.ts.map: dist/src/$(DIST_NAME).d.ts.map
	mv $^ $@

dist/src/$(DIST_NAME).d.ts dist/src/$(DIST_NAME).d.ts.map: dist/$(DIST_NAME).js

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

dist/$(DIST_NAME).js: package.json package-lock.json $(SCRIPT_FILES)
	npm run build

clean:
	rm -rf dist .nyc_output
.PHONY: clean
