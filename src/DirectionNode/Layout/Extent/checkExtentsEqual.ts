import { nameDirection, Direction } from "../../../Direction";
import { DirectionCaret } from "../../../DirectionCaret";
import { Extent } from "./Extent";

export function checkExtentsEqual(
  caret: DirectionCaret<any>,
  direction: Direction,
  expected: Extent,
  resultDom?: HTMLElement
): boolean {
  if (caret.node().layout().extentsAt(direction).equals(expected)) {
    return true;
  }
  if (resultDom) {
    resultDom.appendChild(
      expected.toDom("Expected " + nameDirection(direction) + " extent")
    );
    resultDom.appendChild(
      caret
        .node()
        .layout()
        .extentsAt(direction)
        .toDom("Actual " + nameDirection(direction) + " extent")
    );
    resultDom.appendChild(
      document.createTextNode(
        "Extent offset = " + caret.node().layout().extentOffsetAt(direction)
      )
    );
  }
  return false;
}
