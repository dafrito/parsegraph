DIST_NAME = TODO-PACKAGE-NAME

SCRIPT_FILES = \
	src/$(DIST_NAME).ts

all: build lint test coverage esdoc

build: dist/$(DIST_NAME).js dist/$(DIST_NAME).d.ts
.PHONY: build

demo: dist/$(DIST_NAME).js dist/$(DIST_NAME).d.ts
	npm run demo
.PHONY: demo

dist/$(DIST_NAME).d.ts: dist/src/$(DIST_NAME).d.ts
	mv $^ $@

dist/src/$(DIST_NAME).d.ts: dist/$(DIST_NAME).js

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
