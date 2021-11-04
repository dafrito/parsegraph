import Direction, {
  FORWARD,
  DOWNWARD,
  UPWARD,
  BACKWARD,
} from "parsegraph-direction";
import {
  LayoutCaret,
  LayoutNodePalette,
  style,
  SHRINK_SCALE,
  checkExtentsEqual,
} from "../dist/parsegraph-layout";
import Extent from "parsegraph-extent";

const BUD = "u";
const BLOCK = "b";
const SLOT = "s";

export function getLayoutNodes(node) {
  const list = [];
  const orig = node;
  const start = new Date();
  do {
    node = node._layoutNext;
    // console.log(node._id);
    for (let i = 0; i < list.length; ++i) {
      if (list[i] == node) {
        console.log(list);
        throw new Error("Layout list has loop");
      }
    }
    list.push(node);
    if (elapsed(start) > 5000) {
      throw new Error("Infinite loop");
    }
  } while (orig != node);
  return list;
}

function makeCaret(given) {
  return new LayoutCaret(new LayoutNodePalette(), given);
}

const palette = new LayoutNodePalette();
function makeNode(given) {
  return palette.spawn(given);
}

describe("Package", function () {
  it("Viewport - Trivial layout", function () {
    // Spawn the graph.
    // console.log("TRIV");
    const caret = makeCaret("b");
    caret.node().commitLayoutIteratively();

    // Run the comparison tests.
    if (
      caret.node().extentOffsetAt(FORWARD) !=
      caret.node().blockStyle().minHeight / 2 +
        caret.node().blockStyle().borderThickness +
        caret.node().blockStyle().verticalPadding
    ) {
      console.log(caret.node().extentOffsetAt(FORWARD));
      console.log(caret.node().blockStyle().minHeight / 2);
      console.log(caret.node().blockStyle().borderThickness);
      console.log(caret.node().blockStyle().verticalPadding);
      console.log(
        caret.node().blockStyle().minHeight / 2 +
          caret.node().blockStyle().borderThickness +
          caret.node().blockStyle().verticalPadding
      );
      throw new Error("Forward extent offset for block must match.");
    }

    if (
      caret.node().extentOffsetAt(BACKWARD) !=
      caret.node().blockStyle().minHeight / 2 +
        caret.node().blockStyle().borderThickness +
        caret.node().blockStyle().verticalPadding
    ) {
      console.log(caret.node().extentOffsetAt(BACKWARD));
      console.log(caret.node().blockStyle().minHeight / 2);
      console.log(caret.node().blockStyle().borderThickness);
      console.log(caret.node().blockStyle().verticalPadding);
      throw new Error("Backward extent offset for block must match.");
    }

    if (
      caret.node().extentOffsetAt(UPWARD) !=
      caret.node().blockStyle().minWidth / 2 +
        caret.node().blockStyle().borderThickness +
        caret.node().blockStyle().horizontalPadding
    ) {
      console.log(caret.node().extentOffsetAt(UPWARD));
      console.log(caret.node().blockStyle().minWidth / 2);
      console.log(caret.node().blockStyle().borderThickness);
      console.log(caret.node().blockStyle().horizontalPadding);
      throw new Error("Upward extent offset for block must match.");
    }

    if (
      caret.node().extentOffsetAt(DOWNWARD) !=
      caret.node().blockStyle().minWidth / 2 +
        caret.node().blockStyle().borderThickness +
        caret.node().blockStyle().horizontalPadding
    ) {
      console.log(caret.node().extentOffsetAt(DOWNWARD));
      console.log(caret.node().blockStyle().minWidth / 2);
      console.log(caret.node().blockStyle().borderThickness);
      console.log(caret.node().blockStyle().horizontalPadding);
      throw new Error("Downward extent offset for block must match.");
    }
  });

  it("Viewport - Block with forward bud", function () {
    // Spawn the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(FORWARD, BUD);
    caret.node().commitLayoutIteratively();

    // Run the comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      caret.node().blockStyle().minHeight / 2 +
        caret.node().blockStyle().borderThickness +
        caret.node().blockStyle().verticalPadding,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with backward bud", function () {
    // Spawn the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(BACKWARD, BUD);
    caret.node().commitLayoutIteratively();
    caret.moveToRoot();

    // Run the comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      caret.node().blockStyle().minHeight / 2 +
        caret.node().blockStyle().borderThickness +
        caret.node().blockStyle().verticalPadding,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      caret.node().blockStyle().minHeight / 2 +
        caret.node().blockStyle().borderThickness +
        caret.node().blockStyle().verticalPadding,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("bud").minWidth +
        style("bud").borderThickness * 2 +
        style("bud").horizontalPadding * 2 +
        caret.node().horizontalSeparation(BACKWARD) +
        style("block").minWidth / 2 +
        style("block").borderThickness +
        style("block").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("bud").minWidth +
        style("bud").borderThickness * 2 +
        style("bud").horizontalPadding * 2 +
        caret.node().horizontalSeparation(BACKWARD) +
        style("block").minWidth / 2 +
        style("block").borderThickness +
        style("block").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with downward bud", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(DOWNWARD, BUD);
    caret.node().commitLayoutIteratively();
    caret.moveToRoot();

    // Run the comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("block").verticalPadding +
        style("block").borderThickness +
        style("block").minHeight / 2,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("block").verticalPadding +
        style("block").borderThickness +
        style("block").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("block").minWidth / 2 +
        style("block").borderThickness +
        style("block").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("block").minWidth / 2 +
        style("block").borderThickness +
        style("block").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Bud with downward block", function () {
    // Build the graph.
    const caret = makeCaret(BUD);
    caret.spawn(DOWNWARD, BLOCK);
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run the comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("bu").verticalPadding +
        style("bu").borderThickness +
        style("bu").minHeight / 2,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").verticalPadding +
        style("bu").borderThickness +
        style("bu").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Bud with vertical blocks, two deep", function () {
    // Build the graph.
    const caret = makeCaret(BUD);

    const depth = 2;
    caret.push();
    for (let i = 0; i < depth; ++i) {
      caret.spawnMove(UPWARD, BLOCK);
    }
    caret.pop();
    caret.push();
    for (let i = 0; i < depth; ++i) {
      caret.spawnMove(DOWNWARD, BLOCK);
    }
    caret.pop();
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    const computedBlockSize =
      style("b").verticalPadding * 2 +
      style("b").borderThickness * 2 +
      style("b").minHeight +
      caret.node().nodeAt(UPWARD).verticalSeparation(UPWARD);

    let diff = expect(
      computedBlockSize * (depth - 1) +
        style("b").verticalPadding * 2 +
        style("b").borderThickness * 2 +
        style("b").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("bu").verticalPadding +
        style("bu").borderThickness +
        style("bu").minHeight / 2,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      computedBlockSize * (depth - 1) +
        style("b").verticalPadding * 2 +
        style("b").borderThickness * 2 +
        style("b").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("bu").verticalPadding +
        style("bu").borderThickness +
        style("bu").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with upward bud", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(UPWARD, BUD);
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").horizontalPadding +
        style("b").borderThickness +
        style("b").minWidth / 2,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").horizontalPadding +
        style("b").borderThickness +
        style("b").minWidth / 2,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with upward and downward buds", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);

    caret.spawn(UPWARD, BUD);
    caret.spawn(DOWNWARD, BUD);
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding +
        caret.node().verticalSeparation(UPWARD) +
        style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding +
        caret.node().verticalSeparation(UPWARD) +
        style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with forward and backward buds", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(FORWARD, BUD);
    caret.spawn(BACKWARD, BUD);
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").minWidth +
        style("bu").borderThickness * 2 +
        style("bu").horizontalPadding * 2 +
        caret.node().horizontalSeparation(BACKWARD) +
        style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").minWidth +
        style("bu").borderThickness * 2 +
        style("bu").horizontalPadding * 2 +
        caret.node().horizontalSeparation(BACKWARD) +
        style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Double Axis Sans Backward T layout", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(FORWARD, BUD);
    caret.spawn(UPWARD, BUD);
    caret.spawn(DOWNWARD, BUD);
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    if (
      caret.node().extentOffsetAt(BACKWARD) !=
      caret.node().extentOffsetAt(FORWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (
      caret.node().extentOffsetAt(UPWARD) !=
      caret.node().extentOffsetAt(DOWNWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Positive Direction Layout", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(UPWARD, BUD);
    caret.spawn(FORWARD, BUD);
    caret.node().commitLayoutIteratively();

    // Run the tests.
    if (
      caret.node().extentOffsetAt(BACKWARD) !=
      caret.node().extentOffsetAt(FORWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (
      caret.node().extentOffsetAt(UPWARD) !=
      caret.node().extentOffsetAt(DOWNWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("bu").minHeight +
        style("bu").borderThickness * 2 +
        style("bu").verticalPadding * 2 +
        caret.node().verticalSeparation(UPWARD) +
        style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").minHeight +
        style("bu").borderThickness * 2 +
        style("bu").verticalPadding * 2 +
        caret.node().verticalSeparation(UPWARD) +
        style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Negative Direction Layout", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(BACKWARD, BUD);
    caret.spawn(DOWNWARD, BUD);
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    if (
      caret.node().extentOffsetAt(BACKWARD) !=
      caret.node().extentOffsetAt(FORWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (
      caret.node().extentOffsetAt(UPWARD) !=
      caret.node().extentOffsetAt(DOWNWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").minWidth +
        2 * style("bu").horizontalPadding +
        2 * style("bu").borderThickness +
        caret.node().horizontalSeparation(DOWNWARD) +
        style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").horizontalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minWidth +
        caret.node().horizontalSeparation(DOWNWARD) +
        style("b").horizontalPadding +
        style("b").borderThickness +
        style("b").minWidth / 2,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Double Axis layout", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(BACKWARD, BUD);
    caret.spawn(FORWARD, BUD);
    caret.spawn(UPWARD, BUD);
    caret.spawn(DOWNWARD, BUD);
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    if (
      caret.node().extentOffsetAt(BACKWARD) !=
      caret.node().extentOffsetAt(FORWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (
      caret.node().extentOffsetAt(UPWARD) !=
      caret.node().extentOffsetAt(DOWNWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("bu").minHeight +
        style("bu").borderThickness * 2 +
        style("bu").verticalPadding * 2 +
        caret.node().verticalSeparation(UPWARD) +
        style("b").minHeight / 2 +
        style("b").borderThickness +
        style("b").verticalPadding,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight +
        caret.node().verticalSeparation(FORWARD) +
        style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").minWidth +
        2 * style("bu").horizontalPadding +
        2 * style("bu").borderThickness +
        caret.node().horizontalSeparation(BACKWARD) +
        style("b").horizontalPadding +
        style("b").borderThickness +
        style("b").minWidth / 2,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").horizontalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minWidth +
        caret.node().horizontalSeparation(FORWARD) +
        style("b").horizontalPadding +
        style("b").borderThickness +
        style("b").minWidth / 2,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with shrunk bud", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.fitExact();
    caret.spawnMove(FORWARD, BUD);
    caret.shrink();
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    const expectedSeparation =
      style("b").minWidth / 2 +
      style("b").horizontalPadding +
      style("b").borderThickness +
      SHRINK_SCALE * caret.node().horizontalSeparation(FORWARD) +
      SHRINK_SCALE *
        (style("bu").horizontalPadding +
          style("bu").borderThickness +
          style("bu").minWidth / 2);
    if (caret.node().separationAt(FORWARD) != expectedSeparation) {
      throw new Error(
        "Expected forward separation = " +
          expectedSeparation +
          ", actual = " +
          caret.node().separationAt(FORWARD)
      );
    }

    const downwardExtent = new Extent();
    downwardExtent.appendLS(
      style("b").minWidth +
        style("b").borderThickness * 2 +
        style("b").horizontalPadding * 2 +
        SHRINK_SCALE * caret.node().horizontalSeparation(FORWARD),
      style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2
    );
    downwardExtent.appendLS(
      SHRINK_SCALE *
        (2 * style("bu").horizontalPadding +
          2 * style("bu").borderThickness +
          style("bu").minWidth),
      SHRINK_SCALE *
        (style("bu").horizontalPadding +
          style("bu").borderThickness +
          style("bu").minWidth / 2)
    );

    if (!caret.node().extentsAt(DOWNWARD).equals(downwardExtent)) {
      console.log(downwardExtent.dump());
      caret.node().extentsAt(DOWNWARD).dump();
      throw new Error("Downward extent differs");
      // graph._nodePainter.enableExtentRendering();
      // resultDom.appendChild(
      // graph._container
      // );
      resultDom.appendChild(downwardExtent.toDom("Expected downward extent"));
      resultDom.appendChild(
        caret.node().extentsAt(DOWNWARD).toDom("Actual downward extent")
      );
      resultDom.appendChild(
        document.createTextNode(
          "Extent offset = " + caret.node().extentOffsetAt(DOWNWARD)
        )
      );
      throw new Error("Downward extent differs.");
    }

    const blockHeight =
      style("b").minHeight +
      style("b").borderThickness * 2 +
      style("b").verticalPadding * 2;

    const budHeight =
      style("bu").minHeight +
      style("bu").borderThickness * 2 +
      style("bu").verticalPadding * 2;

    const forwardExtent = new Extent();
    forwardExtent.appendLS(
      blockHeight / 2 - (SHRINK_SCALE * budHeight) / 2,
      style("b").minWidth / 2 +
        style("b").horizontalPadding +
        style("b").borderThickness
    );
    forwardExtent.appendLS(
      SHRINK_SCALE * budHeight,
      style("b").minWidth / 2 +
        style("b").horizontalPadding +
        style("b").borderThickness +
        SHRINK_SCALE * caret.node().horizontalSeparation(FORWARD) +
        SHRINK_SCALE * budHeight
    );
    forwardExtent.appendLS(
      blockHeight / 2 - (SHRINK_SCALE * budHeight) / 2,
      style("b").minWidth / 2 +
        style("b").horizontalPadding +
        style("b").borderThickness
    );

    if (!caret.node().extentsAt(FORWARD).equals(forwardExtent)) {
      throw new Error("Forward extent differs");
      graph._nodePainter.enableExtentRendering();
      resultDom.appendChild(graph._container);
      resultDom.appendChild(forwardExtent.toDom("Expected forward extent"));
      resultDom.appendChild(
        caret.node().extentsAt(FORWARD).toDom("Actual forward extent")
      );
      resultDom.appendChild(
        document.createTextNode(
          "Extent offset = " + caret.node().extentOffsetAt(FORWARD)
        )
      );
      throw new Error("Forward extent differs.");
    }
  });

  it("Viewport - Bud with 2-deep shrunk downward block", function () {
    // Build the graph.
    const caret = makeCaret(BUD);
    caret.fitExact();
    caret.spawnMove(DOWNWARD, BUD);
    caret.shrink();
    caret.spawn(DOWNWARD, BLOCK);
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    const downwardExtent = new Extent();
    downwardExtent.appendLS(
      SHRINK_SCALE *
        (style("b").minWidth +
          style("b").borderThickness * 2 +
          style("b").horizontalPadding * 2),
      style("bu").verticalPadding +
        style("bu").borderThickness +
        style("bu").minHeight / 2 +
        SHRINK_SCALE * caret.node().verticalSeparation(DOWNWARD) +
        SHRINK_SCALE *
          2 *
          (style("bu").verticalPadding +
            style("bu").borderThickness +
            style("bu").minHeight / 2) +
        SHRINK_SCALE *
          caret.node().nodeAt(DOWNWARD).verticalSeparation(DOWNWARD) +
        SHRINK_SCALE *
          (style("b").minHeight +
            style("b").verticalPadding * 2 +
            style("b").borderThickness * 2)
    );

    if (!checkExtentsEqual(caret, DOWNWARD, downwardExtent)) {
      throw new Error("Downward extent differs.");
    }
  });

  it("Viewport - Double Axis Sans Forward T layout", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(BACKWARD, BUD);
    caret.spawn(UPWARD, BUD);
    caret.spawn(DOWNWARD, BUD);
    caret.moveToRoot();
    caret.node().commitLayoutIteratively();

    // Run comparison tests.
    if (
      caret.node().extentOffsetAt(BACKWARD) !=
      caret.node().extentOffsetAt(FORWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (
      caret.node().extentOffsetAt(UPWARD) !=
      caret.node().extentOffsetAt(DOWNWARD)
    ) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    const expect = function (expected, actual) {
      const diff = expected - actual;
      if (diff) {
        console.log("expected=" + expected + ", actual=" + actual);
      }
      return diff;
    };

    let diff = expect(
      style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(FORWARD)
    );
    if (diff) {
      console.log(
        "Forward extent (offset to center=" +
          caret.node().extentOffsetAt(FORWARD) +
          ")"
      );
      const forwardExtent = caret.node().extentsAt(FORWARD);
      forwardExtent.forEach(function (length, size, i) {
        console.log(i + ". l=" + length + ", s=" + size);
      });

      console.log(
        "UPWARDExtent (offset to center=" +
          caret.node().extentOffsetAt(UPWARD) +
          ")"
      );
      const UPWARDExtent = caret.node().extentsAt(UPWARD);
      UPWARDExtent.forEach(function (length, size, i) {
        console.log(i + ". l=" + length + ", s=" + size);
      });

      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").verticalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minHeight +
        caret.node().verticalSeparation(UPWARD) +
        style("b").verticalPadding +
        style("b").borderThickness +
        style("b").minHeight / 2,
      caret.node().extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").minWidth +
        2 * style("bu").horizontalPadding +
        2 * style("bu").borderThickness +
        caret.node().horizontalSeparation(BACKWARD) +
        style("b").minWidth / 2 +
        style("b").borderThickness +
        style("b").horizontalPadding,
      caret.node().extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      style("bu").horizontalPadding * 2 +
        style("bu").borderThickness * 2 +
        style("bu").minWidth +
        caret.node().horizontalSeparation(BACKWARD) +
        style("b").horizontalPadding +
        style("b").borderThickness +
        style("b").minWidth / 2,
      caret.node().extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Centrally aligned back-and-forth", function () {
    const car = makeCaret("b");
    car.spawnMove("d", "bu");
    car.align("f", "c");
    car.spawnMove("f", "bu");
    car.spawnMove("d", "bu");

    car.root().commitLayoutIteratively();

    // const sep = car.root().separationAt(DOWNWARD);
    // console.log("Bud size: " +
    //   (style('bu').horizontalPadding * 2 +
    //   style('bu').borderThickness * 2 +
    //   style('bu').minWidth));
    // console.log("Vertical separation: " +
    //   car.root().verticalSeparation(DOWNWARD));
    // console.log("Block size: " +
    //   (style('b').horizontalPadding * 2 +
    //   style('b').borderThickness * 2 +
    //   style('b').minWidth));
    // console.log(sep);
    /* throw new Error(sep - );
        (style('b').horizontalPadding +
        style('b').borderThickness +
        style('b').minWidth / 2) +
        car.root().verticalSeparation(DOWNWARD) +
        (style('bu').horizontalPadding +
        style('bu').borderThickness +
        style('bu').minWidth / 2)
    );*/
  });

  it("Intra-group move test", function () {
    const car = makeCaret("b");

    const bnode = car.spawn("d", "b");
    car.pull("d");

    const anode = car.spawnMove("f", "u");
    const mnode = car.spawn("d", "b");
    car.root().commitLayoutIteratively();
    const ax = anode.groupX();

    const gx = mnode.groupX();

    const ns = { ...style("b") };
    const increase = 100;
    ns.minWidth += increase;
    bnode.setBlockStyle(ns);
    car.root().commitLayoutIteratively();
    if (ax === anode.groupX()) {
      //simpleGraph(out, car);
      throw new Error(
        "Bud must move when another node grows in size. (ax=" +
          ax +
          ", x=" +
          anode.groupX() +
          ")"
      );
    }
    if (gx + increase / 2 !== mnode.groupX()) {
      //simpleGraph(out, car);
      throw new Error(
        "Node must be moved when another node grows in size. (expected " +
          (gx + increase / 2) +
          " versus actual " +
          mnode.groupX() +
          ")"
      );
    }
  });

  it("Absolute position test", function () {
    const car = makeCaret(BLOCK);
    const bnode = car.spawnMove("f", "b");
    car.spawnMove("f", "b");
    car.root().commitLayoutIteratively();
    car.crease();
    // console.log("bnode", bnode.absoluteX(), bnode.absoluteY());
    // console.log("bnode", bnode.groupX(), bnode.groupY(), bnode.groupScale());
    const bstyle = { ...style("b") };
    bstyle.minWidth += 100;
    bnode.setBlockStyle(bstyle);
    car.root().commitLayoutIteratively();
    // console.log("bnode", bnode.groupX(), bnode.groupY(), bnode.groupScale());
    // console.log("bnode", bnode.absoluteX(), bnode.absoluteY());
  });

  function makeChild() {
    const car = makeCaret(BLOCK);
    car.spawnMove("f", "b");
    car.spawnMove("i", "b");
    car.spawnMove("f", "s");
    return car.root();
  }

  function makeChild2() {
    const car = makeCaret(SLOT);
    car.spawnMove("i", "b");
    car.spawnMove("f", "s");
    car.spawnMove("i", "b");
    car.spawnMove("f", "b");
    return car.root();
  }

  it("Node lisp test simplified", function () {
    const root = makeNode(BUD);
    root._id = "root";

    const a = makeNode(BLOCK);
    a._id = "a";
    const b = makeNode(BLOCK);
    b._id = "b";
    const c = makeNode(BLOCK);
    c._id = "c";

    const chi = makeNode(BUD);
    chi._id = "chi";

    chi.connectNode(FORWARD, c);

    a.connectNode(DOWNWARD, chi);
    a.connectNode(FORWARD, b);
    // console.log("LISP TEST");
    // console.log(getLayoutNodes(a));
    root.connectNode(FORWARD, a);

    root.commitLayoutIteratively();
  });

  it("Right-to-left test", function () {
    const node = makeNode(BUD);
    node.setRightToLeft(true);
  });

  it("Disconnect trivial test", function () {
    const car = makeCaret(BUD);
    car.node().commitLayoutIteratively();
    const originalRoot = car.node();
    car.spawnMove("f", "b");
    car.node().commitLayoutIteratively();
    const newRoot = car.node();
    car.disconnect();
    originalRoot.commitLayoutIteratively();
    newRoot.commitLayoutIteratively();
  });

  it("Proportion pull test", function () {
    const car = makeCaret(BUD);
    car.node().commitLayoutIteratively();
    const originalRoot = car.node();
    originalRoot._id = "ROOT";
    // car.spawn('b', 'u');
    // car.spawn('f', 'u');

    /*    car.spawnMove('d', 'b');
      car.push();
      car.spawnMove('b', 'u');
      car.spawnMove('d', 'u');
      car.spawnMove('d', 's');
      car.label('2');
      car.pop();

      car.push();
      car.spawnMove('f', 'u');
      car.spawnMove('d', 'u');
      car.spawnMove('d', 's');
      car.label('2');
      car.pop();

      car.pull('d');
      */

    car.spawnMove("d", "b");
    car.node()._id = "CENTER BLOCK";
    car.push();
    car.spawnMove("b", "u");
    car.node()._id = "DOWN BUD";
    // car.spawnMove('d', 's');
    // car.label('1');
    car.pop();

    // car.push();
    // car.spawnMove('f', 'u');
    // car.spawnMove('d', 's');
    // car.label('1');
    // car.pop();

    // console.log("Proportion test start");
    car.pull("d");

    // car.spawnMove('d', 's');

    try {
      originalRoot.commitLayoutIteratively();
      // console.log("Proportion test SUCCESS");
    } finally {
      // console.log("Proportion test finished");
    }
  });
});
