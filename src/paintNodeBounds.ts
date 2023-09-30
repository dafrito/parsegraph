import { DirectionNode } from "./DirectionNode";
import { LinePainter } from "./paintNodeLines";

export function paintNodeBounds(node: DirectionNode, painter: LinePainter) {
  const layout = node.layout();
  const size = layout.groupSize();
  const x = layout.groupX();
  const y = layout.groupY();
  const w = size.width();
  const h = size.height();
  painter(x, y, w, h);
}
