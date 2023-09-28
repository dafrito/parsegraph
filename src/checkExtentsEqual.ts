import { nameDirection, Direction, DirectionCaret } from "./direction";
import Extent from "./extent";

export default function checkExtentsEqual(
  caret: DirectionCaret<any>,
  direction: Direction,
  expected: Extent,
  resultDom?: HTMLElement
): boolean {
  if (caret.node().getLayout().extentsAt(direction).equals(expected)) {
    return true;
  }
  if (resultDom) {
    resultDom.appendChild(
      expected.toDom("Expected " + nameDirection(direction) + " extent")
    );
    resultDom.appendChild(
      caret
        .node()
        .getLayout()
        .extentsAt(direction)
        .toDom("Actual " + nameDirection(direction) + " extent")
    );
    resultDom.appendChild(
      document.createTextNode(
        "Extent offset = " +
          caret.node().getLayout().extentOffsetAt(direction)
      )
    );
  }
  return false;
}
