import { NodePalette } from "parsegraph-direction";
import LayoutNode from "./LayoutNode";

const minSize = 10;
const borderThickness = 1;
const padding = 2;
const borderRoundness = 1;
const separation = 5;

const BUD_STYLE = {
  minHeight: minSize,
  minWidth: minSize,
  borderThickness,
  borderRoundness,
  verticalPadding: padding,
  horizontalPadding: padding,
  verticalSeparation: separation,
  horizontalSeparation: separation * 2,
};

const SLOT_STYLE = {
  minHeight: minSize,
  minWidth: minSize * 2,
  borderThickness,
  verticalPadding: padding,
  horizontalPadding: padding,
  verticalSeparation: separation,
  horizontalSeparation: separation,
};

const BLOCK_STYLE = {
  minHeight: minSize,
  minWidth: minSize * 2,
  borderThickness,
  verticalPadding: padding,
  horizontalPadding: padding,
  verticalSeparation: separation,
  horizontalSeparation: separation,
};

export function style(given?: any): any {
  if (!given) {
    given = "u";
  }

  switch (given) {
    case "b":
    case "block":
      return BLOCK_STYLE;
    case "s":
    case "slot":
      return SLOT_STYLE;
    default:
      return BUD_STYLE;
  }
}

export default class LayoutNodePalette extends NodePalette<LayoutNode> {
  spawn(given?: any): LayoutNode {
    if (given instanceof LayoutNode) {
      return given;
    }
    const node = new LayoutNode();
    this.replace(node, given);
    return node;
  }
  replace(node: LayoutNode, given?: any): void {
    node.setBlockStyle(style(given));
  }
}
