import { Direction } from "../../../Direction";
import { DirectionCaret } from "../../../DirectionCaret";
import { Extent } from "./Extent";

export function checkExtentsEqual(
  caret: DirectionCaret<any>,
  direction: Direction,
  expected: Extent
): boolean {
  return caret.node().layout().extentsAt(direction).equals(expected);
}
