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
import Camera from 'parsegraph-camera';
import { readStyle } from './demoutils';
import { BasicGLProvider } from 'parsegraph-compileprogram';
import { WebGLBlockPainter } from "parsegraph-blockpainter";
import Color from 'parsegraph-color';
import buildGraph from './demograph';

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
};

document.addEventListener("DOMContentLoaded", () => {
  const glProvider = new BasicGLProvider();

  const painters = new WeakMap<DirectionNode, WebGLBlockPainter>();

  const graph = buildGraph();
  const cld = new CommitLayoutData(graph, {
    ...layoutPainter,
    paint: (pg: DirectionNode): boolean => {
      console.log("Painting", pg);
      if (!painters.get(pg)) {
        painters.set(pg, new WebGLBlockPainter(glProvider));
      }

      // Count the blocks for each node.
      let numBlocks = 0;
      pg.forEachNode((n) => {
        paintNodeBounds(n as DirectionNode, (x, y, w, h) => {
          numBlocks++;
        });
        paintNodeLines(n as DirectionNode, 1, (x, y, w, h) => {
          numBlocks++;
        });
      })

      const painter = painters.get(pg);
      if (!painter) {
        throw new Error("Impossible")
      }
      painter.initBuffer(numBlocks);

      const borderRoundedness = 0;
      const borderThickness = 0;
      const lineRoundedness = 0;
      const lineThickness = 0;
      painter.setBackgroundColor(new Color(.5, .5, .5));
      painter.setBorderColor(new Color(1, 1, 1));

      pg.forEachNode((n) => {
        paintNodeBounds(n as DirectionNode, (x, y, w, h) => {
          painter.drawBlock(x, y, w, h, borderRoundedness, borderThickness);
        });
        paintNodeLines(n as DirectionNode, 1, (x, y, w, h) => {
          painter.drawBlock(x, y, w, h, lineRoundedness, lineThickness);
        });
      })

      return false;
    }
  });

  // Add canvas to root
  const root = document.getElementById("demo");
  if (!root) {
    throw new Error("root not found");
  }
  root.style.position = "relative";
  root.style.width = "100vw";
  root.style.height = "100vh";
  glProvider.gl();

  const canvas = glProvider.canvas();

  canvas.style.width = "100%";
  canvas.style.height = "100%";

  glProvider.container().style.width = "100%";
  glProvider.container().style.height = "100%";

  root.appendChild(glProvider.container());

  const cam = new Camera();

  const count = 0;
  while (cld.crank()) {
    if (count > 100) {
      throw new Error("Commit layout is looping forever");
    }
  }

  glProvider.container().addEventListener("mousemove", (e) => {
    //console.log("mousemove", e);
  });

  const loop = () => {
    cam.setSize(glProvider.width(), glProvider.height());

    if (glProvider.canProject()) {
      const world = cam.project();

      glProvider.render();

      const gl = glProvider.gl();
      gl.viewport(0, 0, cam.width(), cam.height());

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      graph.forEachPaintGroup(pg => {
        const painter = painters.get(pg as DirectionNode);
        if (!painter) {
          console.log("No paint group for pg " + pg);
          return;
        }

        console.log("Rendering", (pg as DirectionNode).state().id());
        painter.render(world, 1.0);
      });
    } else {
      requestAnimationFrame(loop);
    }
  }

  requestAnimationFrame(loop);
});
