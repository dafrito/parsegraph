import {
  Direction,
  Axis,
  FORWARD,
  DOWNWARD,
  UPWARD,
  BACKWARD,
} from "../src/Direction";

import {
  DirectionNode
} from "../src/DirectionNode";

import {
  DirectionCaret
} from "../src/DirectionCaret";

import { CommitLayoutData } from "../src";
import { Extent, checkExtentsEqual } from "../src/DirectionNode/Layout/Extent";
import { Size } from "../src/Size";

import { assert } from "chai";

const BUD = "u";
const BLOCK = "b";
const SHRINK_SCALE = 0.85;

const makeNode = (value?: any) => {
  const n = new DirectionNode();
  n.setValue(value);
  return n;
};

const expect = function (expected: any, actual: any) {
  const diff = expected - actual;
  if (diff) {
    console.log("expected=" + expected + ", actual=" + actual);
  }
  return diff;
};

export function getLayoutNodes(node: DirectionNode) {
  const list = [];
  const orig = node;
  const MAX_SIBLINGS = 100000;
  let count = 0;
  do {
    node = node._layoutNext;
    for (let i = 0; i < list.length; ++i) {
      if (list[i] == node) {
        throw new Error("Layout list has loop");
      }
    }
    list.push(node);
    if (count++ > MAX_SIBLINGS) {
      throw new Error("Infinite loop");
    }
  } while (orig != node);
  return list;
}

function makeCaret(given?: any) {
  return new DirectionCaret<string | BlockStyle>(given);
}

interface BlockStyle {
  minWidth: number;
  minHeight: number;
  borderThickness: number;
  verticalPadding: number;
  horizontalPadding: number;
  verticalSeparation: number;
  horizontalSeparation: number;
}

const BLOCK_STYLE = {
  minWidth: 200,
  minHeight: 100,
  borderThickness: 4,
  verticalPadding: 2,
  horizontalPadding: 4,
  horizontalSeparation: 10,
  verticalSeparation: 10,
};

const BUD_STYLE = {
  minWidth: 30,
  minHeight: 30,
  borderThickness: 4,
  verticalPadding: 4,
  horizontalPadding: 4,
  horizontalSeparation: 10,
  verticalSeparation: 10,
};

const EMPTY_STYLE = {
  minWidth: 100,
  minHeight: 100,
  borderThickness: 0,
  verticalPadding: 0,
  horizontalPadding: 0,
  horizontalSeparation: 10,
  verticalSeparation: 10,
};

const readStyle = (given?: any): BlockStyle => {
  if (given && typeof given === "object") {
    // Assume it is already a style.
    return given;
  }
  if (given && !given.toUpperCase) {
    throw new Error("Not a string" + given + " " + JSON.stringify(given));
  }
  switch (given?.toUpperCase()) {
    case "B":
    case "BLOCK":
      return BLOCK_STYLE;
    case "BU":
    case "U":
    case "BUD":
      return BUD_STYLE;
    default:
      return EMPTY_STYLE;
  }
};

const layoutPainter = {
  size: (node: DirectionNode, size: Size) => {
    const style = readStyle(node.value());
    size.setWidth(
      style.minWidth + style.borderThickness * 2 + style.horizontalPadding * 2
    );
    size.setHeight(
      style.minHeight + style.borderThickness * 2 + style.verticalPadding * 2
    );
  },
  getSeparation: (
    node: DirectionNode,
    axis: Axis,
    dir: Direction,
    preferVertical: boolean
  ) => {
    const style = readStyle(node.value());
    switch (axis) {
      case Axis.VERTICAL:
        return style.verticalSeparation;
      case Axis.HORIZONTAL:
        return style.horizontalSeparation;
      case Axis.Z:
        if (preferVertical) {
          return style.verticalPadding - style.borderThickness;
        }
        return style.horizontalPadding - style.borderThickness;
    }
    return 0;
  },

  paint: (_: DirectionNode): boolean => {
    return false;
  },
};

const commitLayout = (node: DirectionNode) => {
  const cld = new CommitLayoutData(node, layoutPainter);

  const count = 0;
  while (cld.crank()) {
    if (count > 100) {
      throw new Error("Commit layout is looping forever");
    }
  }
};

const verticalSeparation = (node: DirectionNode, dir: Direction) => {
  return layoutPainter.getSeparation(node, Axis.VERTICAL, dir, true);
};

const horizontalSeparation = (node: DirectionNode, dir: Direction) => {
  return layoutPainter.getSeparation(node, Axis.HORIZONTAL, dir, false);
};

describe("Package", function () {
  it("Viewport - Trivial layout", function () {
    // Spawn the graph.
    // console.log("TRIV");
    const caret = makeCaret("b");
    commitLayout(caret.node());

    const layout = caret.node().layout();
    const style = readStyle(BLOCK);

    // Run the comparison tests.
    if (
      layout.extentOffsetAt(FORWARD) !=
      style.minHeight / 2 + style.borderThickness + style.verticalPadding
    ) {
      console.log("forward extent offset=", layout.extentOffsetAt(FORWARD));
      console.log("half height=", style.minHeight / 2);
      console.log("border thickness=", style.borderThickness);
      console.log("vertical padding=", style.verticalPadding);
      console.log(
        "computed forward extent offset=",
        style.minHeight / 2 + style.borderThickness + style.verticalPadding
      );
      throw new Error("Forward extent offset for block must match.");
    }

    if (
      layout.extentOffsetAt(BACKWARD) !=
      style.minHeight / 2 + style.borderThickness + style.verticalPadding
    ) {
      console.log(layout.extentOffsetAt(BACKWARD));
      console.log(style.minHeight / 2);
      console.log(style.borderThickness);
      console.log(style.verticalPadding);
      throw new Error("Backward extent offset for block must match.");
    }

    if (
      layout.extentOffsetAt(UPWARD) !=
      style.minWidth / 2 + style.borderThickness + style.horizontalPadding
    ) {
      console.log(layout.extentOffsetAt(UPWARD));
      console.log(style.minWidth / 2);
      console.log(style.borderThickness);
      console.log(style.horizontalPadding);
      throw new Error("Upward extent offset for block must match.");
    }

    if (
      layout.extentOffsetAt(DOWNWARD) !=
      style.minWidth / 2 + style.borderThickness + style.horizontalPadding
    ) {
      console.log(layout.extentOffsetAt(DOWNWARD));
      console.log(style.minWidth / 2);
      console.log(style.borderThickness);
      console.log(style.horizontalPadding);
      throw new Error("Downward extent offset for block must match.");
    }
  });

  it("Viewport - Block with forward bud", function () {
    // Spawn the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(FORWARD, BUD);
    commitLayout(caret.node());

    const layout = caret.node().layout();
    const style = readStyle(BLOCK);

    // Run the comparison tests.

    let diff = expect(
      style.minHeight / 2 + style.borderThickness + style.verticalPadding,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with backward bud", function () {
    // Spawn the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(BACKWARD, BUD);
    commitLayout(caret.node());
    caret.moveToRoot();

    const rootNode = caret.node();
    const layout = caret.node().layout();
    const style = readStyle(BLOCK);

    // Run the comparison tests.

    let diff = expect(
      style.minHeight / 2 + style.borderThickness + style.verticalPadding,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      style.minHeight / 2 + style.borderThickness + style.verticalPadding,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bud").minWidth +
        readStyle("bud").borderThickness * 2 +
        readStyle("bud").horizontalPadding * 2 +
        horizontalSeparation(rootNode, BACKWARD) +
        readStyle("block").minWidth / 2 +
        readStyle("block").borderThickness +
        readStyle("block").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bud").minWidth +
        readStyle("bud").borderThickness * 2 +
        readStyle("bud").horizontalPadding * 2 +
        horizontalSeparation(rootNode, BACKWARD) +
        readStyle("block").minWidth / 2 +
        readStyle("block").borderThickness +
        readStyle("block").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
    );
    if (diff) {
      throw new Error("Downward extent offset is off by " + diff);
    }
  });

  it("Viewport - Block with downward bud", function () {
    // Build the graph.
    const caret = makeCaret(BLOCK);
    caret.spawn(DOWNWARD, BUD);
    commitLayout(caret.node());
    caret.moveToRoot();

    const layout = caret.node().layout();

    // Run the comparison tests.

    let diff = expect(
      readStyle("block").verticalPadding +
        readStyle("block").borderThickness +
        readStyle("block").minHeight / 2,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("block").verticalPadding +
        readStyle("block").borderThickness +
        readStyle("block").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("block").minWidth / 2 +
        readStyle("block").borderThickness +
        readStyle("block").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("block").minWidth / 2 +
        readStyle("block").borderThickness +
        readStyle("block").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    const layout = caret.node().layout();

    // Run the comparison tests.

    let diff = expect(
      readStyle("bu").verticalPadding +
        readStyle("bu").borderThickness +
        readStyle("bu").minHeight / 2,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").verticalPadding +
        readStyle("bu").borderThickness +
        readStyle("bu").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    const rootNode = caret.node();
    const layout = caret.node().layout();

    // Run comparison tests.

    const computedBlockSize =
      readStyle("b").verticalPadding * 2 +
      readStyle("b").borderThickness * 2 +
      readStyle("b").minHeight +
      verticalSeparation(caret.node().nodeAt(UPWARD), UPWARD);

    let diff = expect(
      computedBlockSize * (depth - 1) +
        readStyle("b").verticalPadding * 2 +
        readStyle("b").borderThickness * 2 +
        readStyle("b").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("bu").verticalPadding +
        readStyle("bu").borderThickness +
        readStyle("bu").minHeight / 2,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      computedBlockSize * (depth - 1) +
        readStyle("b").verticalPadding * 2 +
        readStyle("b").borderThickness * 2 +
        readStyle("b").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("bu").verticalPadding +
        readStyle("bu").borderThickness +
        readStyle("bu").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    const rootNode = caret.node();
    const layout = caret.node().layout();

    // Run comparison tests.

    let diff = expect(
      readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").horizontalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minWidth / 2,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").horizontalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minWidth / 2,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    const rootNode = caret.node();
    const layout = caret.node().layout();

    // Run comparison tests.

    let diff = expect(
      readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    // Run comparison tests.

    const rootNode = caret.node();
    const layout = caret.node().layout();

    let diff = expect(
      readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").minWidth +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").horizontalPadding * 2 +
        horizontalSeparation(rootNode, BACKWARD) +
        readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").minWidth +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").horizontalPadding * 2 +
        horizontalSeparation(rootNode, BACKWARD) +
        readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    // Run comparison tests.
    const rootNode = caret.node();
    const layout = caret.node().layout();

    if (layout.extentOffsetAt(BACKWARD) != layout.extentOffsetAt(FORWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (layout.extentOffsetAt(UPWARD) != layout.extentOffsetAt(DOWNWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    let diff = expect(
      readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    // Run the tests.
    const rootNode = caret.node();
    const layout = caret.node().layout();

    if (layout.extentOffsetAt(BACKWARD) != layout.extentOffsetAt(FORWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (layout.extentOffsetAt(UPWARD) != layout.extentOffsetAt(DOWNWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    let diff = expect(
      readStyle("bu").minHeight +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").verticalPadding * 2 +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").minHeight +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").verticalPadding * 2 +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    // Run comparison tests.
    const rootNode = caret.node();
    const layout = caret.node().layout();
    if (layout.extentOffsetAt(BACKWARD) != layout.extentOffsetAt(FORWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (layout.extentOffsetAt(UPWARD) != layout.extentOffsetAt(DOWNWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    let diff = expect(
      readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").minWidth +
        2 * readStyle("bu").horizontalPadding +
        2 * readStyle("bu").borderThickness +
        horizontalSeparation(rootNode, DOWNWARD) +
        readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").horizontalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minWidth +
        horizontalSeparation(rootNode, DOWNWARD) +
        readStyle("b").horizontalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minWidth / 2,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    // Run comparison tests.
    const rootNode = caret.node();
    const layout = caret.node().layout();
    if (layout.extentOffsetAt(BACKWARD) != layout.extentOffsetAt(FORWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (layout.extentOffsetAt(UPWARD) != layout.extentOffsetAt(DOWNWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    let diff = expect(
      readStyle("bu").minHeight +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").verticalPadding * 2 +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").minHeight / 2 +
        readStyle("b").borderThickness +
        readStyle("b").verticalPadding,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight +
        verticalSeparation(rootNode, FORWARD) +
        readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").minWidth +
        2 * readStyle("bu").horizontalPadding +
        2 * readStyle("bu").borderThickness +
        horizontalSeparation(rootNode, BACKWARD) +
        readStyle("b").horizontalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minWidth / 2,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").horizontalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minWidth +
        horizontalSeparation(rootNode, FORWARD) +
        readStyle("b").horizontalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minWidth / 2,
      layout.extentOffsetAt(DOWNWARD)
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
    commitLayout(caret.node());

    // Run comparison tests.
    const rootNode = caret.node();
    const expectedSeparation =
      readStyle("b").minWidth / 2 +
      readStyle("b").horizontalPadding +
      readStyle("b").borderThickness +
      SHRINK_SCALE * horizontalSeparation(rootNode, FORWARD) +
      SHRINK_SCALE *
        (readStyle("bu").horizontalPadding +
          readStyle("bu").borderThickness +
          readStyle("bu").minWidth / 2);
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
      readStyle("b").minWidth +
        readStyle("b").borderThickness * 2 +
        readStyle("b").horizontalPadding * 2 +
        SHRINK_SCALE * horizontalSeparation(rootNode, FORWARD),
      readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2
    );
    downwardExtent.appendLS(
      SHRINK_SCALE *
        (2 * readStyle("bu").horizontalPadding +
          2 * readStyle("bu").borderThickness +
          readStyle("bu").minWidth),
      SHRINK_SCALE *
        (readStyle("bu").horizontalPadding +
          readStyle("bu").borderThickness +
          readStyle("bu").minWidth / 2)
    );

    if (!caret.node().layout().extentsAt(DOWNWARD).equals(downwardExtent)) {
      console.log(downwardExtent.dump(""));
      caret.node().layout().extentsAt(DOWNWARD).dump("");
      throw new Error("Downward extent differs");
      /* // graph._nodePainter.enableExtentRendering();
      // resultDom.appendChild(
      // graph._container
      // );
      resultDom.appendChild(downwardExtent.toDom("Expected downward extent"));
      resultDom.appendChild(
        caret.node().extentsAt(DOWNWARD).toDom("Actual downward extent")
      );
      resultDom.appendChild(
        document.createTextNode(
          "Extent offset = " + layout.extentOffsetAt(DOWNWARD)
        )
      );
      throw new Error("Downward extent differs.");*/
    }

    const blockHeight =
      readStyle("b").minHeight +
      readStyle("b").borderThickness * 2 +
      readStyle("b").verticalPadding * 2;

    const budHeight =
      readStyle("bu").minHeight +
      readStyle("bu").borderThickness * 2 +
      readStyle("bu").verticalPadding * 2;

    assert.isNotNaN(blockHeight);
    assert.isNotNaN(budHeight);
    assert.isNotNaN(readStyle("b").minWidth);
    assert.isNotNaN(readStyle("b").minHeight);
    assert.isNotNaN(horizontalSeparation(rootNode, FORWARD));

    const forwardExtent = new Extent();
    forwardExtent.appendLS(
      blockHeight / 2 - (SHRINK_SCALE * budHeight) / 2,
      readStyle("b").minWidth / 2 +
        readStyle("b").horizontalPadding +
        readStyle("b").borderThickness
    );
    forwardExtent.appendLS(
      SHRINK_SCALE * budHeight,
      readStyle("b").minWidth / 2 +
        readStyle("b").horizontalPadding +
        readStyle("b").borderThickness +
        SHRINK_SCALE * horizontalSeparation(rootNode, FORWARD) +
        SHRINK_SCALE * budHeight
    );
    forwardExtent.appendLS(
      blockHeight / 2 - (SHRINK_SCALE * budHeight) / 2,
      readStyle("b").minWidth / 2 +
        readStyle("b").horizontalPadding +
        readStyle("b").borderThickness
    );

    if (
      !caret.node().layout().extentsAt(FORWARD).equals(forwardExtent, 1e-3)
    ) {
      console.log(forwardExtent.dump("Expected forward extents"));
      console.log(
        caret
          .node()
          .layout()
          .extentsAt(FORWARD)
          .dump("Given forward extents")
      );
      throw new Error("Forward extent differs");
      /* graph._nodePainter.enableExtentRendering();
      resultDom.appendChild(graph._container);
      resultDom.appendChild(forwardExtent.toDom("Expected forward extent"));
      resultDom.appendChild(
        caret.node().extentsAt(FORWARD).toDom("Actual forward extent")
      );
      resultDom.appendChild(
        document.createTextNode(
          "Extent offset = " + layout.extentOffsetAt(FORWARD)
        )
      );
      throw new Error("Forward extent differs.");*/
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
    commitLayout(caret.node());

    // Run comparison tests.
    const rootNode = caret.node();
    const downwardExtent = new Extent();
    downwardExtent.appendLS(
      SHRINK_SCALE *
        (readStyle("b").minWidth +
          readStyle("b").borderThickness * 2 +
          readStyle("b").horizontalPadding * 2),
      readStyle("bu").verticalPadding +
        readStyle("bu").borderThickness +
        readStyle("bu").minHeight / 2 +
        SHRINK_SCALE * verticalSeparation(rootNode, DOWNWARD) +
        SHRINK_SCALE *
          2 *
          (readStyle("bu").verticalPadding +
            readStyle("bu").borderThickness +
            readStyle("bu").minHeight / 2) +
        SHRINK_SCALE *
          verticalSeparation(caret.node().nodeAt(DOWNWARD), DOWNWARD) +
        SHRINK_SCALE *
          (readStyle("b").minHeight +
            readStyle("b").verticalPadding * 2 +
            readStyle("b").borderThickness * 2)
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
    commitLayout(caret.node());

    // Run comparison tests.
    const rootNode = caret.node();
    const layout = caret.node().layout();
    if (layout.extentOffsetAt(BACKWARD) != layout.extentOffsetAt(FORWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    if (layout.extentOffsetAt(UPWARD) != layout.extentOffsetAt(DOWNWARD)) {
      throw new Error(
        "Graphs symmetric about the root should" +
          " have symmetric extent offsets."
      );
    }

    let diff = expect(
      readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(FORWARD)
    );
    if (diff) {
      console.log(
        "Forward extent (offset to center=" +
          layout.extentOffsetAt(FORWARD) +
          ")"
      );
      const forwardExtent = caret.node().layout().extentsAt(FORWARD);
      forwardExtent.forEach(function (length: number, size: number, i: number) {
        console.log(i + ". l=" + length + ", s=" + size);
      });

      console.log(
        "UPWARDExtent (offset to center=" + layout.extentOffsetAt(UPWARD) + ")"
      );
      const UPWARDExtent = caret.node().layout().extentsAt(UPWARD);
      UPWARDExtent.forEach(function (length: number, size: number, i: number) {
        console.log(i + ". l=" + length + ", s=" + size);
      });

      throw new Error("Forward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").verticalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minHeight +
        verticalSeparation(rootNode, UPWARD) +
        readStyle("b").verticalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minHeight / 2,
      layout.extentOffsetAt(BACKWARD)
    );
    if (diff) {
      throw new Error("Backward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").minWidth +
        2 * readStyle("bu").horizontalPadding +
        2 * readStyle("bu").borderThickness +
        horizontalSeparation(rootNode, BACKWARD) +
        readStyle("b").minWidth / 2 +
        readStyle("b").borderThickness +
        readStyle("b").horizontalPadding,
      layout.extentOffsetAt(UPWARD)
    );
    if (diff) {
      throw new Error("Upward extent offset is off by " + diff);
    }

    diff = expect(
      readStyle("bu").horizontalPadding * 2 +
        readStyle("bu").borderThickness * 2 +
        readStyle("bu").minWidth +
        horizontalSeparation(rootNode, BACKWARD) +
        readStyle("b").horizontalPadding +
        readStyle("b").borderThickness +
        readStyle("b").minWidth / 2,
      layout.extentOffsetAt(DOWNWARD)
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

    commitLayout(car.root());

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
    commitLayout(car.root());
    const ax = anode.layout().groupX();
    assert.isNotNaN(ax);

    const gx = mnode.layout().groupX();
    assert.isNotNaN(gx);

    const ns = { ...readStyle("b") };
    const increase = 100;
    ns.minWidth += increase;
    bnode.setValue(ns);
    bnode.layoutChanged();
    commitLayout(car.root());
    if (ax === anode.layout().groupX()) {
      // simpleGraph(out, car);
      throw new Error(
        "Bud must move when another node grows in size. (ax=" +
          ax +
          ", x=" +
          anode.layout().groupX() +
          ")"
      );
    }
    if (gx + increase / 2 !== mnode.layout().groupX()) {
      // simpleGraph(out, car);
      throw new Error(
        "Node must be moved when another node grows in size. (expected " +
          (gx + increase / 2) +
          " versus actual " +
          mnode.layout().groupX() +
          ")"
      );
    }
  });

  it("Absolute position test", function () {
    const car = makeCaret(BLOCK);
    const bnode = car.spawnMove("f", "b");
    car.spawnMove("f", "b");
    commitLayout(car.root());
    car.crease();
    // console.log("bnode", bnode.absoluteX(), bnode.absoluteY());
    // console.log("bnode", bnode.groupX(), bnode.groupY(), bnode.groupScale());
    const bstyle = { ...readStyle("b") };
    bstyle.minWidth += 100;
    bnode.setValue(bstyle);
    commitLayout(car.root());
    // console.log("bnode", bnode.groupX(), bnode.groupY(), bnode.groupScale());
    // console.log("bnode", bnode.absoluteX(), bnode.absoluteY());
  });

  it("Node lisp test simplified", function () {
    const root = makeNode(BUD);
    root.state().setId("root");

    const a = makeNode(BLOCK);
    a.state().setId("a");
    const b = makeNode(BLOCK);
    b.state().setId("b");
    const c = makeNode(BLOCK);
    c.state().setId("c");

    const chi = makeNode(BUD);
    chi.state().setId("chi");

    chi.connectNode(FORWARD, c);

    a.connectNode(DOWNWARD, chi);
    a.connectNode(FORWARD, b);
    // console.log("LISP TEST");
    // console.log(getLayoutNodes(a));
    root.connectNode(FORWARD, a);

    commitLayout(root);
  });

  it("Right-to-left test", function () {
    const node = makeNode(BUD);
    node.state().setRightToLeft(true);
  });

  it("Crease test", function () {
    const root = makeNode(BLOCK);
    let node = root;
    for (let i = 0; i < 100; ++i) {
      const inner = makeNode(BUD);
      if (i % 5 === 0) {
        inner.crease();
      }
      node.connectNode(Direction.INWARD, inner);
      node = inner;
    }
    commitLayout(root);
    assert.isNotTrue(root.layout().needsCommit());
  });

  it("Disconnect trivial test", function () {
    const car = makeCaret(BUD);
    commitLayout(car.node());
    const originalRoot = car.node();
    car.spawnMove("f", "b");
    commitLayout(car.node());
    const newRoot = car.node();
    car.disconnect();
    commitLayout(originalRoot);
    commitLayout(newRoot);
  });

  it("Diagonal block test", function () {
    const makeBlock = () => {
      return new DirectionNode();
    };

    const root = makeBlock();
    let creased: DirectionNode | undefined = undefined;

    let n: DirectionNode = root;
    for (let i = 0; i < 10; ++i) {
      const child = makeBlock();
      n.connectNode(i % 2 ? Direction.FORWARD : Direction.DOWNWARD, child);
      n = child;
      if (i == 5) {
        n.crease();
        n.state().setScale(0.5);
        creased = n;
      }
    }

    commitLayout(root);

    root.forEachPaintGroup((pg) => {
      assert(!pg.layout().needsAbsolutePos());
    });
    assert(!root.layout().needsAbsolutePos());
    assert(!creased?.layout().needsAbsolutePos());

    assert(
      creased?.layout().absoluteScale() !== null,
      "Scale must not be null"
    );
    assert(creased?.layout().absoluteScale() === 0.5, "Scale must be 0.5");
  });

  it("Proportion pull test", function () {
    const car = makeCaret(BUD);
    commitLayout(car.node());
    const originalRoot = car.node();
    originalRoot.state().setId("ROOT");
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
    car.node().state().setId("CENTER BLOCK");
    car.push();
    car.spawnMove("b", "u");
    car.node().state().setId("DOWN BUD");
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
      commitLayout(originalRoot);
      // console.log("Proportion test SUCCESS");
    } finally {
      // console.log("Proportion test finished");
    }
  });

  it("Connect override test", () => {
    let car = makeCaret(BUD);
    commitLayout(car.node());
    const originalRoot = car.node();
    originalRoot.state().setId("ROOT");
    for (let i = 0; i < 5; ++i) {
      const subCar = makeCaret(BUD);
      car.node().connectNode(Direction.DOWNWARD, subCar.root());
      commitLayout(originalRoot);
      const nextCar = makeCaret(BLOCK);
      car.node().connectNode(Direction.DOWNWARD, nextCar.root());
      car = nextCar;
      commitLayout(originalRoot);
    }
  });
});
