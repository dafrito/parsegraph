import { nameDirection, Direction } from "./src";
import LayoutCaret from "./LayoutCaret";
import Extent from "./extent";

export default function checkExtentsEqual(
  caret: LayoutCaret,
  direction: Direction,
  expected: Extent,
  resultDom?: HTMLElement
): boolean {
  if (caret.node().value().getLayout().extentsAt(direction).equals(expected)) {
    return true;
  }
  if (resultDom) {
    resultDom.appendChild(
      expected.toDom("Expected " + nameDirection(direction) + " extent")
    );
    resultDom.appendChild(
      caret
        .node()
        .value()
        .getLayout()
        .extentsAt(direction)
        .toDom("Actual " + nameDirection(direction) + " extent")
    );
    resultDom.appendChild(
      document.createTextNode(
        "Extent offset = " +
          caret.node().value().getLayout().extentOffsetAt(direction)
      )
    );
  }
  return false;
}
