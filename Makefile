SCRIPT_FILES = \
	src/PagingBuffer.js \
	src/BufferPage.js

build: dist/pagingbuffer.js
.PHONY: build

demo: dist/parsegraph.js
	npm run demo
.PHONY: demo

check:
	npm run test
.PHONY: check

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
	rm -rf dist coverage .nyc_output
.PHONY: clean
