import {
  CommitLayoutData,
  LINE_THICKNESS,
} from ".";
import { Fit, DirectionCaret, AxisOverlap } from "./direction";
import paintNodeLines from "./paintNodeLines";
import paintNodeBounds from "./paintNodeBounds";

document.addEventListener("DOMContentLoaded", () => {
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

  // Build graph
  const car = new DirectionCaret<BasicPositioned>();
  car.node().setValue(new BasicPositioned(car.node()));
  // car.node().state().setNodeFit(Fit.EXACT)
  car.node().value().setBlockStyle({
    minHeight: 10,
    minWidth: 10,
    borderThickness: 2,
    verticalPadding: 3,
    horizontalPadding: 3,
    verticalSeparation: 4,
    horizontalSeparation: 4,
  });

  const choices = ["f", "b", "d", "u"];
  for (let i = 0; i < 10; ++i) {
    let choice: string;
    do {
      choice = choices[Math.floor(Math.random() * choices.length)];
    } while (car.has(choice));
    car.spawnMove(choice);
    car.node().setValue(new BasicPositioned(car.node()));
    // car.node().state().setNodeFit(Fit.EXACT)
    car.node().setAxisOverlap(AxisOverlap.ALLOWED);
    car.node().value().setBlockStyle({
      minHeight: 10,
      minWidth: 10,
      borderThickness: 2,
      verticalPadding: 3,
      horizontalPadding: 3,
      verticalSeparation: 4,
      horizontalSeparation: 4,
    });
  }

  // Commit the layout
  const graph = car.root();
  const cld = new CommitLayoutData(graph, 0);
  cld.commitLayoutLoop(0);

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
