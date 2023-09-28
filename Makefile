DIST_NAME = layout

SCRIPT_FILES = \
	src/CommitLayoutData.ts \
	src/Exception.ts \
	src/index.ts \
	src/autocommit.ts \
	src/paintGroupBounds.ts \
	src/paintNodeBounds.ts \
	src/paintNodeLines.ts \
	src/log.ts \
	src/Layout.ts \
	src/BaseCommitLayoutData.ts \
	src/checkExtentsEqual.ts \
	src/demo.ts \
	src/rect/index.ts \
	src/size/index.ts \
	src/generateid/index.ts \
	src/fuzzyequals/index.ts \
	src/extent/Extent.ts \
	src/extent/ExtentCombiner.ts \
	src/extent/ExtentSeparator.ts \
	src/extent/index.ts \
	src/direction/DirectionNode.ts \
	src/direction/DirectionCaret.ts \
	src/direction/DirectionNodePaintGroup.ts \
	src/direction/DirectionNodeSiblings.ts \
	src/direction/DirectionNodeState.ts \
	src/direction/Fit.ts \
	src/direction/NeighborData.ts \
	src/direction/Alignment.ts \
	src/direction/Axis.ts \
	src/direction/AxisOverlap.ts \
	src/direction/LayoutState.ts \
	src/direction/Direction.ts \
	src/direction/PreferredAxis.ts \
	src/direction/turn.ts \
	src/direction/utils.ts \
	src/direction/index.ts \
	test/test.ts

EXTRA_SCRIPTS =

include ./Makefile.microproject
