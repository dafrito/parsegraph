DIST_NAME = TODO-PACKAGE-NAME

SCRIPT_FILES = \
	src/index.ts

all: build lint test coverage esdoc

build: dist/$(DIST_NAME).js
.PHONY: build

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

dist/$(DIST_NAME).js: package.json package-lock.json $(SCRIPT_FILES)
	npm run build

clean:
	rm -rf dist .nyc_output
.PHONY: clean
