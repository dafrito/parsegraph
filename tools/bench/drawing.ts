import { DirectionNode, paintNodeBounds, paintNodeLines } from "../../src";

export function geometry(nodes: DirectionNode[]) {
  return nodes.map((n) => {
    const l = n.layout(),
      size: number[] = [];
    l.size(size);
    return [
      l.absoluteX(),
      l.absoluteY(),
      l.absoluteScale(),
      l.groupX(),
      l.groupY(),
      l.groupScale(),
      ...size,
      ...[2, 3, 4, 5].flatMap((d) => [
        l.extentsAt(d).offset(),
        l.extentsAt(d).numBounds(),
      ]),
    ];
  });
}

/** Draw the committed graph using the same public primitives as the SVG viewer. */
export function drawing(nodes: DirectionNode[]) {
  const ids = new Map(nodes.map((node, i) => [node, i]));
  const rectangles: {
    kind: string;
    node: number;
    group: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }[] = [];
  for (const node of nodes) {
    const group = node.paintGroup().node();
    const l = group.layout();
    const scale = l.absoluteScale();
    const emit =
      (kind: string) =>
      (x: number, y: number, width: number, height: number) => {
        rectangles.push({
          kind,
          node: ids.get(node)!,
          group: ids.get(group)!,
          x: l.absoluteX() + x * scale,
          y: l.absoluteY() + y * scale,
          width: width * scale,
          height: height * scale,
        });
      };
    paintNodeLines(node, 1, emit("line"));
    paintNodeBounds(node, emit("body"));
  }
  return { type: "drawing", geometry: geometry(nodes), rectangles };
}
