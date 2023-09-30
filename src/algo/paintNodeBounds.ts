import { DirectionNode } from "./direction";
import { LinePainter } from "./paintNodeLines";

export default function paintNodeBounds(
  node: DirectionNode,
  painter: LinePainter
) {
  const layout = node.getLayout();
  const size = layout.groupSize();
  const x = layout.groupX();
  const y = layout.groupY();
  const w = size.width();
  const h = size.height();
  painter(x, y, w, h);
}
