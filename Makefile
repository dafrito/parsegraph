DIST_NAME = layout

SCRIPT_FILES = \
	src/CommitLayoutData.ts \
	src/Exception.ts \
	src/index.ts \
	src/Positioned.ts \
	src/BasicPositioned.ts \
	src/autocommit.ts \
	src/paintGroupBounds.ts \
	src/log.ts \
	src/LayoutCaret.ts \
	src/LayoutNode.ts \
	src/LayoutNodePalette.ts \
	src/Layout.ts \
	src/BaseCommitLayoutData.ts \
	src/checkExtentsEqual.ts \
	src/demo.ts \
	test/test.ts

EXTRA_SCRIPTS =

include ./Makefile.microproject
