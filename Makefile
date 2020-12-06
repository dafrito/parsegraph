SCRIPT_FILES = \
	src/PagingBuffer.ts \
	src/BufferPage.ts

all: build lint test coverage esdoc

build: dist/pagingbuffer.js
.PHONY: build

demo: dist/parsegraph.js
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
	npx prettier --write src www
.PHONY: prettier

lint:
	npx eslint --fix $(SCRIPT_FILES)
.PHONY: lint

esdoc:
	npx esdoc
.PHONY: esdoc

doc: esdoc
.PHONY: doc

dist/pagingbuffer.js: $(SCRIPT_FILES)
	npm run build

clean:
	rm -rf dist .nyc_output
.PHONY: clean
