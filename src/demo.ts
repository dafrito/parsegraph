import { CommitLayoutData, LINE_THICKNESS } from ".";
import Direction, {
  Fit,
  DirectionCaret,
  AxisOverlap,
  DirectionNode,
} from "./direction";
import paintNodeLines from "./paintNodeLines";
import paintNodeBounds from "./paintNodeBounds";
import Axis from "./direction/Axis";
import Size from "./size";
import { BlockStyle, readStyle } from "./demoutils";
import buildGraph from './demograph';
import { BasicGLProvider } from 'parsegraph-compileprogram';
import { WebGLBlockPainter } from 'parsegraph-blockpainter';

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

  paint: (pg: DirectionNode): boolean => {
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

document.addEventListener("DOMContentLoaded", () => {
  const graph = buildGraph();
  commitLayout(graph);

  // Create canvas
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 400;

  // Add canvas to root
  const root = document.getElementById("demo");
  if (!root) {
    throw new Error("root not found");
  }
  root.style.position = "relative";
  root.appendChild(canvas);

  requestAnimationFrame(() => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("canvas context not available");
    }
    ctx.fillStyle = "maroon";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.translate(canvas.width / 2, canvas.height / 2);

    ctx.fillStyle = "black";
    graph.forEachPaintGroup((pg) => {
      pg.forEachNode((n) => {
        paintNodeBounds(n as DirectionNode, (x, y, w, h) => {
          ctx.fillRect(x - w / 2, y - h / 2, w, h);
        });
        paintNodeLines(n as DirectionNode, 1, (x, y, w, h) => {
          ctx.fillRect(x - w / 2, y - h / 2, w, h);
        });
      });
    });
  });
});
