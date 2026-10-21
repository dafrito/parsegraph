import { Axis, Direction } from "../Direction";
import { DirectionNode, Alignment, LayoutPainter } from "../DirectionNode";
import { Presentation } from "./types";

/**
 * Presets expand into explicit rules; consumers need not recognize preset names.
 * @param {string} preset - The geometry convention to expand.
 * @return {Presentation} A fresh presentation payload.
 */
export function createPresentation(
  preset: "standard" | "proportional" | "math" = "standard"
): Presentation {
  if (!["standard", "proportional", "math"].includes(preset)) {
    throw new Error(`Unknown presentation preset: ${preset}`);
  }
  const square = preset === "math";
  return {
    text: { fontFamily: "sans-serif", fontSize: 10, lineHeight: 10 },
    styles: {
      block: {
        minWidth: 10,
        minHeight: 15,
        paddingX: 3,
        paddingY: 2.5,
        square,
      },
      bud: { minWidth: 7.5, minHeight: 7.5, paddingX: 0, paddingY: 0, square },
      slot: { minWidth: 10, minHeight: 15, paddingX: 3, paddingY: 2.5, square },
    },
    defaultStyle: "block",
    nodeStyles: {},
    spacing: {
      horizontal: square ? 0 : 5,
      vertical: square ? 0 : 5,
      inward: square ? 0 : 5,
      ...(preset === "proportional" ? { verticalStep: 20 } : {}),
    },
  };
}

export type MeasureLabel = (
  value: unknown,
  text: Presentation["text"]
) => readonly [number, number];

/**
 * Standard v1 text policy: literal lines, no wrapping, numbers as JSON text.
 * @param {function} measureLine - Host font measurement for one complete line.
 * @return {MeasureLabel} A content measurement callback.
 */
export function createTextMeasurer(
  measureLine: (line: string, text: Presentation["text"]) => number
): MeasureLabel {
  return (value, text) => {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new Error(
        "Structured values require an application-specific content adapter"
      );
    }
    const label = typeof value === "number" ? JSON.stringify(value) : value;
    const lines = label.replace(/\r\n?/g, "\n").split("\n");
    const widths = lines.map((line) => measureLine(line, text));
    if (widths.some((width) => !Number.isFinite(width) || width < 0)) {
      throw new Error("Line widths must be finite nonnegative numbers");
    }
    return [
      widths.reduce((max, width) => Math.max(max, width), 0),
      lines.length * text.lineHeight,
    ];
  };
}

/**
 * Creates geometry callbacks without introducing font or graphics dependencies.
 * Pass a validated presentation. The host measures content and draws it using
 * the same rules. Inward child extents are available during bottom-up layout.
 * @param {Presentation} presentation - Validated geometry rules.
 * @param {MeasureLabel} measure - Host content measurement callback.
 * @return {LayoutPainter} Size and separation callbacks, without rendering.
 */
export function createPresentationPainter(
  presentation: Presentation,
  measure: MeasureLabel
): LayoutPainter {
  const size = (node: DirectionNode, out: number[]) => {
    const id = String(node.id());
    const styleName = Object.prototype.hasOwnProperty.call(
      presentation.nodeStyles,
      id
    )
      ? presentation.nodeStyles[id]
      : presentation.defaultStyle;
    const style = presentation.styles[styleName];
    if (!style) {
      throw new Error(`Unknown node style: ${styleName}`);
    }
    const content =
      node.value() === undefined
        ? [0, 0]
        : measure(node.value(), presentation.text);
    if (
      content.length !== 2 ||
      content.some((n) => !Number.isFinite(n) || n < 0)
    ) {
      throw new Error(
        "Content measurement must be two finite nonnegative numbers"
      );
    }
    let [width, height] = content;
    if (node.neighbors().hasNode(Direction.INWARD)) {
      const child = node.neighbors().nodeAt(Direction.INWARD);
      const extent = [0, 0];
      child.layout().extentSize(extent);
      const childWidth = extent[0] * child.scale();
      const childHeight = extent[1] * child.scale();
      if (
        node.neighbors().getAlignment(Direction.INWARD) ===
        Alignment.INWARD_VERTICAL
      ) {
        width = Math.max(width, childWidth);
        height += childHeight + presentation.spacing.inward;
      } else {
        width += childWidth + presentation.spacing.inward;
        height = Math.max(height, childHeight);
      }
    }
    out[0] = Math.max(style.minWidth, width + 2 * style.paddingX);
    out[1] = Math.max(style.minHeight, height + 2 * style.paddingY);
    if (style.square) {
      out[0] = out[1] = Math.max(out[0], out[1]);
    }
  };
  return {
    size,
    getSeparation(node, axis, direction) {
      if (axis === Axis.Z) return presentation.spacing.inward;
      if (axis === Axis.HORIZONTAL) return presentation.spacing.horizontal;
      let gap = presentation.spacing.vertical;
      if (presentation.spacing.verticalStep !== undefined) {
        const child = node.neighbors().nodeAt(direction);
        const parentSize = [0, 0];
        const childSize = [0, 0];
        size(node, parentSize);
        size(child, childSize);
        // CommitLayout multiplies the returned gap by the child's scale.
        gap = Math.max(
          gap,
          (presentation.spacing.verticalStep -
            parentSize[1] / 2 -
            (childSize[1] * child.scale()) / 2) /
            child.scale()
        );
      }
      return gap;
    },
  };
}
