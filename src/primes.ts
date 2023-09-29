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
import Camera from "parsegraph-camera";
import { BasicGLProvider } from "parsegraph-compileprogram";
import { BlockType, CanvasBlockPainter, WebGLBlockPainter } from "parsegraph-blockpainter";
import Color from "parsegraph-color";
import {
  matrixIdentity3x3,
  matrixMultiply3x3,
  makeTranslation3x3,
  makeScale3x3,
} from "parsegraph-matrix";
import PrimesWidget from "./primes/PrimesWidget";

const BORDER_THICKNESS = 1/2;

const layoutPainter = {
  size: (node: DirectionNode, size: Size) => {
    size.setWidth(10);
    size.setHeight(10);
  },
  getSeparation: () => {
    return BORDER_THICKNESS/10;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const glProvider = new BasicGLProvider();

  const painters = new WeakMap<DirectionNode, WebGLBlockPainter>();

  const widget = new PrimesWidget();
  const cld = new CommitLayoutData(widget.node(), {
    ...layoutPainter,
    paint: (pg: DirectionNode): boolean => {
      //console.log("Painting", pg);
      if (!painters.get(pg)) {
        painters.set(pg, new WebGLBlockPainter(glProvider, BlockType.SIMPLE));
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
      });

      const painter = painters.get(pg);
      if (!painter) {
        throw new Error("Impossible");
      }
      painter.clear();
      painter.initBuffer(numBlocks);

      const grey = new Color(1, 1, 1);
      const greyblue = new Color(0.8, 0.8, 1);
      const white = new Color(.2, .2, .2);

      pg.forEachNode((n) => {
        if (typeof (n as DirectionNode).value() !== "number") {
          painter.setBackgroundColor(greyblue);
          painter.setBorderColor(white);
        } else {
          painter.setBackgroundColor(grey);
          painter.setBorderColor(white);
        }
        paintNodeBounds(n as DirectionNode, (x, y, w, h) => {
          painter.drawBlock(x, y, w, h, 0, 0);
        });

        painter.setBackgroundColor(grey);
        painter.setBorderColor(white);
        paintNodeLines(n as DirectionNode, BORDER_THICKNESS/2, (x, y, w, h) => {
          painter.drawBlock(x, y, w, h, 0, 0);
        });
      });

      return false;
    },
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

  const overlay = document.createElement("canvas");
  overlay.style.position = 'absolute';
  overlay.style.pointerEvents = "none";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";

  glProvider.container().style.width = "100%";
  glProvider.container().style.height = "100%";

  root.appendChild(glProvider.container());
  root.appendChild(overlay);

  const cam = new Camera();

  const reticlePainter = new WebGLBlockPainter(glProvider, BlockType.SQUARE);
  let selectedNode: DirectionNode;
  const needsRepaint = true;

  const loop = () => {
    cam.setSize(glProvider.width(), glProvider.height());
    overlay.width = glProvider.width();
    overlay.height = glProvider.height();
    const ctx = overlay.getContext('2d');
    if (!ctx) {
      throw new Error("No 2d context");
    }
    ctx?.clearRect(0, 0, overlay.width, overlay.height);
    ctx.textBaseline = "top";
    ctx.fillStyle = "white";
    ctx.font = "24px sans";

    const count = 0;
    const startTime = Date.now();
    while (cld.crank()) {
      if (Date.now() > startTime + (1000/60)) {
        requestAnimationFrame(loop);
        ctx.fillText("commit layout", 0, 0);
        return;
      }
    }

    if (origCld) {
      const bx = origCld.getLayout().absoluteX();
      const by = origCld.getLayout().absoluteY();
      console.log("cam.adjustOrigin", bx, by);
      cam.adjustOrigin(-bx, -by);
      origCld = cld.startingNode();
    }

    if (glProvider.canProject()) {
      const world = cam.project();

      glProvider.render();

      const gl = glProvider.gl();
      gl.viewport(0, 0, cam.width(), cam.height());

      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.DST_ALPHA);

      let needsUpdate = false;
      widget.node().forEachPaintGroup((pg) => {
        const painter = painters.get(pg as DirectionNode);
        if (!painter) {
          needsUpdate = true;
          return;
        }

        const layout = pg.getLayout();
        const scale = layout.absoluteScale();

        const moveMat = makeTranslation3x3(
          layout.absoluteX(),
          layout.absoluteY()
        );
        const scaleMat = makeScale3x3(scale, scale);

        painter.render(matrixMultiply3x3(scaleMat, moveMat, world), 2.0);
      });

      // Draw reticle
      if (selectedNode) {
        reticlePainter.clear();
        reticlePainter.setBackgroundColor(new Color(1, 1, 0, 1));
        reticlePainter.setBorderColor(new Color(1, 1, 0, 1));
        reticlePainter.initBuffer(1);
        const layout = selectedNode.getLayout();
        reticlePainter.drawBlock(
          layout.absoluteX(),
          layout.absoluteY(),
          layout.absoluteSize().width(),
          layout.absoluteSize().height(),
          2,
          2
        );
        reticlePainter.render(world, 1.0);
      }

      console.log("drawing overlay");
      const canvasBlockPainter = new CanvasBlockPainter(ctx);
      canvasBlockPainter.initBuffer(1);
      canvasBlockPainter.setBackgroundColor(new Color(1, 0, 0, 1))
      canvasBlockPainter.setBorderColor(new Color(1, 1, 1, 1))
      ctx.save();
      const metrics = ctx.measureText("test");
      const overlayHeight = metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent;
      ctx.translate(overlay.width/2, overlay.height-overlayHeight);
      canvasBlockPainter.drawBlock(0, 0, metrics.width, metrics.fontBoundingBoxAscent + metrics.fontBoundingBoxDescent, 0, 0)
      canvasBlockPainter.render(matrixIdentity3x3())
      ctx.fillStyle = "white";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText("test", 0, 0)
      ctx.restore();
      
      if (needsUpdate) {
        requestAnimationFrame(loop);
      } else if (isDown && widget.position < 1000) {
        origCld = cld.startingNode();
        widget.step();
        cld.reset(widget.node());
        requestAnimationFrame(loop);
      }
    } else {
      requestAnimationFrame(loop);
    }
    ctx.fillText("painted", 0, 0);
  };

  let origCld: DirectionNode;

  let isDown: Date | undefined;
  glProvider.container().addEventListener("mousedown", (e) => {
    requestAnimationFrame(loop);
    isDown = new Date();
  });

  glProvider.container().addEventListener("mouseup", (e) => {
    if (!isDown) {
      return;
    }
    if (Date.now() - isDown.getTime() < 1000) {
      // Treat as click.
      console.log("click", e);
      const [x, y] = cam.transform(e.offsetX, e.offsetY);
      const selected = widget.node().getLayout().nodeUnderCoords(x, y, 1.0);
      if (selected) {
        alert(selected.state().id() + " " + selected.state().value());
      }
    }
    isDown = undefined;
  });

  glProvider.container().addEventListener("mousemove", (e) => {
    requestAnimationFrame(loop);
    if (isDown) {
      console.log("mousemove", e.movementX, e.movementY);
      cam.adjustOrigin(e.movementX / cam.scale(), e.movementY / cam.scale());
      return;
    }
    const [x, y] = cam.transform(e.offsetX, e.offsetY);
    selectedNode = widget.node().getLayout().nodeUnderCoords(x, y, 1.0);
    if (selectedNode) {
      console.log(selectedNode);
    }
  });

  glProvider.container().addEventListener("wheel", (e) => {
    console.log(e);
    cam.zoomToPoint(Math.pow(1.1, e.deltaY / 100), e.offsetX, e.offsetY);
    requestAnimationFrame(loop);
  });

  requestAnimationFrame(loop);
});
