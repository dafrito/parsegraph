import { DirectionNode } from "./direction";

import Positioned from "./Positioned";

type LayoutNode<Value extends Positioned = Positioned> = DirectionNode<Value>;

export default LayoutNode;
