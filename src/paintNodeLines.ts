import {
  Direction,
  isVerticalDirection,
  directionSign,
  forEachCardinalDirection,
} from "./Direction";

import { DirectionNode } from "./DirectionNode";

export type BoundsPainter = (
  x: number,
  y: number,
  w: number,
  h: number
) => void;

const size = [NaN, NaN];

const drawLine = (
  lineThickness: number,
  painter: BoundsPainter,
  direction: Direction,
  node: DirectionNode
) => {
  if (node.neighbors().parentDirection() == direction) {
    return;
  }
  if (!node.neighbors().hasChild(direction)) {
    // Do not draw lines unless there is a node.
    return;
  }
  const directionData = node.neighbors().at(direction);

  const layout = node.layout();
  const parentScale = layout.groupScale();
  const scale = directionData.neighbor()?.layout().groupScale();
  if (typeof scale !== "number" || isNaN(scale)) {
    console.log(directionData.node);
    throw new Error(
      directionData.node + "'s groupScale must be a number but was " + scale
    );
  }

  const thickness = lineThickness * scale;
  const x = layout.groupX();
  const y = layout.groupY();
  layout.size(size);
  const length =
    directionSign(direction) *
    parentScale *
    (directionData.lineLength() -
      (isVerticalDirection(direction) ? size[1] : size[0]) / 2);
  if (isVerticalDirection(direction)) {
    painter(
      x,
      y + length / 2 + (parentScale * directionSign(direction) * size[1]) / 2,
      thickness,
      Math.abs(length)
    );
  } else {
    // Horizontal line.
    painter(
      x + length / 2 + (parentScale * directionSign(direction) * size[0]) / 2,
      y,
      Math.abs(length),
      thickness
    );
  }
};

/**
 * Paints a given node's lines using the provided painter.
 *
 * The painter will be called for each child direction of the given node, providing
 * the bounds of the drawn line that connects the parent to its child.
 *
 * @param {DirectionNode} node the parent node
 * @param {number} lineThickness the size of the connecting line
 * @param {BoundsPainter} painter
 */
export function paintNodeLines(
  node: DirectionNode,
  lineThickness: number,
  painter: BoundsPainter
) {
  if (
    !(node instanceof DirectionNode) ||
    arguments.length !== 3 ||
    isNaN(lineThickness) ||
    typeof painter !== "function"
  ) {
    throw new Error("Usage: paintNodeLines(node, lineThickness, painter)");
  }
  forEachCardinalDirection((dir: Direction) => {
    drawLine(lineThickness, painter, dir, node);
  });
}
