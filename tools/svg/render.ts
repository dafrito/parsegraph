import {
  Alignment,
  FocusBounds,
  CommitLayout,
  Direction,
  DirectionNode,
  Presentation,
  createPresentation,
  createPresentationPainter,
  createTextMeasurer,
  deserializeParsegraphDocument,
  paintNodeLines,
  resolveNodeAppearance,
} from "../../src";

export interface SvgOptions {
  /** Optional post-layout framing. No focus option preserves the whole-graph view. */
  focus?: { nodeId: string; frame?: boolean; outline?: boolean };
  width?: number;
  height?: number;
  padding?: number;
}

const NS = "http://www.w3.org/2000/svg";
function element(
  name: string,
  attributes: Record<string, string | number> = {}
) {
  const result = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes))
    result.setAttribute(key, String(value));
  return result;
}

/** Static SVG export. Browser-only so measurement uses an actual font engine. */
export async function renderSvg(input: unknown, options: SvgOptions = {}) {
  for (const dimension of [options.width, options.height]) {
    if (
      dimension !== undefined &&
      (!Number.isFinite(dimension) || dimension <= 0)
    ) {
      throw new Error("Image dimensions must be finite positive numbers");
    }
  }
  if (
    options.focus &&
    (typeof options.focus.nodeId !== "string" || !options.focus.nodeId.length)
  )
    throw new Error("Focus requires a nonempty node ID");
  const padding = options.padding ?? 16;
  if (!Number.isFinite(padding) || padding < 0)
    throw new Error("Padding must be finite and nonnegative");
  const loaded = deserializeParsegraphDocument(input);
  if (!loaded.root) throw new Error("The graph is empty");
  const presentation: Presentation =
    loaded.presentation || createPresentation();
  if (!loaded.presentation) {
    loaded.root.paintGroup().forEach((group) =>
      group.siblings().forEach((node) => {
        presentation.nodeStyles[String(node.id())] =
          node.value() === undefined ? "bud" : "block";
      })
    );
  }
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas font measurement is unavailable");
  const { fontFamily, fontSize, lineHeight } = presentation.text;
  context.font = `normal ${fontSize}px ${fontFamily}`;
  const font = context.font;
  await document.fonts.load(font);
  await document.fonts.ready;
  const measureLine = (line: string) => context.measureText(line).width;
  const measure = createTextMeasurer(measureLine);
  const painter = createPresentationPainter(presentation, measure);
  const layout = new CommitLayout(loaded.root, painter);
  const deadline = performance.now() + 30000;
  while (layout.crank()) {
    if (performance.now() > deadline)
      throw new Error("Layout exceeded the 30-second export limit");
  }

  // Parent-first order keeps containing bodies behind their inward contents.
  const nodes: DirectionNode[] = [];
  const stack = [loaded.root];
  const visited = new Set<DirectionNode>();
  while (stack.length) {
    const node = stack.pop() as DirectionNode;
    if (visited.has(node))
      throw new Error("Graph contains a cycle or repeated child");
    visited.add(node);
    nodes.push(node);
    for (const direction of [
      Direction.BACKWARD,
      Direction.FORWARD,
      Direction.UPWARD,
      Direction.DOWNWARD,
      Direction.INWARD,
    ]) {
      if (node.neighbors().hasChild(direction))
        stack.push(node.neighbors().nodeAt(direction));
    }
  }
  const svg = element("svg", {
    preserveAspectRatio: "xMidYMid meet",
    role: "img",
  });
  const title = element("title");
  title.textContent = `Parsegraph (${nodes.length} nodes)`;
  svg.appendChild(title);
  const scene = element("g");
  svg.appendChild(scene);
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const include = (x: number, y: number, width: number, height: number) => {
    if (
      ![x, y, width, height].every(Number.isFinite) ||
      width < 0 ||
      height < 0
    )
      throw new Error("Layout produced invalid geometry");
    minX = Math.min(minX, x - width / 2);
    minY = Math.min(minY, y - height / 2);
    maxX = Math.max(maxX, x + width / 2);
    maxY = Math.max(maxY, y + height / 2);
  };
  const geometry: {
    id: string;
    x: number;
    y: number;
    scale: number;
    width: number;
    height: number;
    paintGroup: string;
  }[] = [];
  for (const node of nodes) {
    const appearance = loaded.appearance
      ? resolveNodeAppearance(loaded.appearance, String(node.id()))
      : undefined;
    const nodeLayout = node.layout();
    const scale = nodeLayout.absoluteScale();
    const x = nodeLayout.absoluteX(),
      y = nodeLayout.absoluteY();
    const size = [0, 0];
    nodeLayout.size(size);
    include(x, y, size[0] * scale, size[1] * scale);
    geometry.push({
      id: String(node.id()),
      x,
      y,
      scale,
      width: size[0] * scale,
      height: size[1] * scale,
      paintGroup: String(node.paintGroup().node().id()),
    });
    const group = node.paintGroup().node().layout();
    paintNodeLines(node, 0.5, (gx, gy, width, height) => {
      const ax = group.absoluteX() + gx * group.absoluteScale();
      const ay = group.absoluteY() + gy * group.absoluteScale();
      const aw = width * group.absoluteScale(),
        ah = height * group.absoluteScale();
      include(ax, ay, aw, ah);
      scene.appendChild(
        element("rect", {
          fill: appearance?.lineColor ?? "#64748b",
          "fill-opacity": appearance?.lineAlpha ?? 1,
          x: ax - aw / 2,
          y: ay - ah / 2,
          width: aw,
          height: ah,
        })
      );
    });
    const id = String(node.id());
    const styleName = Object.prototype.hasOwnProperty.call(
      presentation.nodeStyles,
      id
    )
      ? presentation.nodeStyles[id]
      : presentation.defaultStyle;
    const style = presentation.styles[styleName];
    const colors: Record<string, string> = {
      block: "#d9f99d",
      slot: "#f8fafc",
      bud: "#fef3c7",
    };
    const fill = Object.prototype.hasOwnProperty.call(colors, styleName)
      ? colors[styleName]
      : "#e2e8f0";
    const body = element("g", {
      "data-node-id": id,
      transform: `translate(${x} ${y}) scale(${scale})`,
    });
    const stroke = Math.min(0.5, size[0], size[1]);
    body.appendChild(
      element("rect", {
        x: (-size[0] + stroke) / 2,
        y: (-size[1] + stroke) / 2,
        width: size[0] - stroke,
        height: size[1] - stroke,
        fill: appearance?.backgroundColor ?? fill,
        "fill-opacity": appearance?.backgroundAlpha ?? 1,
        stroke: appearance?.borderColor ?? "#475569",
        "stroke-opacity": appearance?.borderAlpha ?? 1,
        "stroke-width": stroke,
        rx: style.square ? 0 : Math.min(2, size[0] / 2, size[1] / 2),
      })
    );
    if (node.value() !== undefined) {
      const value = node.value();
      const label =
        typeof value === "number" ? JSON.stringify(value) : String(value);
      const content = measure(value, presentation.text);
      const labelLines = label.replace(/\r\n?/g, "\n").split("\n");
      let centerX = 0,
        top = -content[1] / 2;
      if (node.neighbors().hasNode(Direction.INWARD)) {
        if (
          node.neighbors().getAlignment(Direction.INWARD) ===
          Alignment.INWARD_VERTICAL
        ) {
          top = -size[1] / 2 + style.paddingY;
        } else centerX = -size[0] / 2 + style.paddingX + content[0] / 2;
      }
      labelLines.forEach((line, index) => {
        if (!line.length) return;
        const metrics = context.measureText(line);
        const baseline =
          top +
          (index + 0.5) * lineHeight +
          (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) /
            2;
        const text = element("text", {
          x: centerX,
          y: baseline,
          "text-anchor": "middle",
          fill: appearance?.textColor ?? "#0f172a",
          "fill-opacity": appearance?.textAlpha ?? 1,
          textLength: metrics.width,
          lengthAdjust: "spacingAndGlyphs",
        });
        text.setAttribute("style", `font: ${font}; white-space: pre`);
        text.textContent = line;
        body.appendChild(text);
      });
    }
    scene.appendChild(body);
  }
  let focusBounds: FocusBounds | undefined;
  if (options.focus) {
    const target = nodes.find(
      (node) => String(node.id()) === options.focus.nodeId
    );
    if (!target) throw new Error(`Unknown focus node: ${options.focus.nodeId}`);
    focusBounds = target.layout().focusBounds();
    if (options.focus.outline) {
      const { left, top, right, bottom } = focusBounds;
      scene.appendChild(
        element("rect", {
          "data-focus-node-id": options.focus.nodeId,
          x: left,
          y: top,
          width: right - left,
          height: bottom - top,
          fill: "none",
          stroke: "#b34722",
          "stroke-width": 2,
          "stroke-dasharray": "6 4",
          "vector-effect": "non-scaling-stroke",
          "pointer-events": "none",
        })
      );
    }
    if (options.focus.frame) {
      minX = focusBounds.left;
      minY = focusBounds.top;
      maxX = focusBounds.right;
      maxY = focusBounds.bottom;
    }
  }
  const viewWidth = Math.max(1, maxX - minX + 2 * padding);
  const viewHeight = Math.max(1, maxY - minY + 2 * padding);
  const width =
    options.width ??
    (options.height ? (options.height * viewWidth) / viewHeight : 1200);
  const height = options.height ?? (width * viewHeight) / viewWidth;
  svg.setAttribute(
    "viewBox",
    `${minX - padding} ${minY - padding} ${viewWidth} ${viewHeight}`
  );
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.insertBefore(
    element("rect", {
      x: minX - padding,
      y: minY - padding,
      width: viewWidth,
      height: viewHeight,
      fill: loaded.appearance?.pageBackgroundColor ?? "white",
      "fill-opacity": loaded.appearance?.pageBackgroundAlpha ?? 1,
    }),
    scene
  );
  return {
    svg: new XMLSerializer().serializeToString(svg),
    nodes: nodes.length,
    geometry,
    viewBox: [minX - padding, minY - padding, viewWidth, viewHeight],
    ...(focusBounds ? { focusBounds } : {}),
    ignoredCapabilities: loaded.ignoredCapabilities,
  };
}
