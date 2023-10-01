import { DirectionNode} from "./DirectionNode";
import { Direction } from "../Direction";

export const eachChild = (
  root: DirectionNode,
  visitor: (node: DirectionNode, dir: Direction) => void,
  visitorThisArg?: object
): void => {
  const dirs = root.siblings().layoutOrder();
  for (let i = 0; i < dirs.length; ++i) {
    const dir = dirs[i];
    if (!root.neighbors().isRoot() && dir === root.parentDirection()) {
      continue;
    }
    const node = root.neighbors().nodeAt(dir);
    if (node) {
      visitor.call(visitorThisArg, node, dir);
    }
  }
}
