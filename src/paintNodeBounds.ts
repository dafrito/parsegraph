import { DirectionNode } from "./DirectionNode";
import { BoundsPainter } from "./paintNodeLines";

const size = [NaN, NaN];

export function paintNodeBounds(node: DirectionNode, painter: BoundsPainter) {
  const layout = node.layout();
  layout.groupSize(size);
  const x = layout.groupX();
  const y = layout.groupY();
  const w = size[0];
  const h = size[1];
  painter(x, y, w, h);
}
