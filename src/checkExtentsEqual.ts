import {nameDirection, Direction} from 'parsegraph-direction';
import LayoutCaret from './LayoutCaret';
import Extent from 'parsegraph-extent';
import LayoutNode from './LayoutNode';

export default function checkExtentsEqual(
    caret:LayoutCaret<LayoutNode>,
    direction:Direction,
    expected:Extent,
    resultDom?:HTMLElement,
):boolean {
  if (caret.node().extentsAt(direction).equals(expected)) {
    return true;
  }
  if (resultDom) {
    resultDom.appendChild(
        expected.toDom(
            'Expected ' + nameDirection(direction) + ' extent',
        ),
    );
    resultDom.appendChild(
        caret
            .node()
            .extentsAt(direction)
            .toDom('Actual ' + nameDirection(direction) + ' extent'),
    );
    resultDom.appendChild(
        document.createTextNode(
            'Extent offset = ' + caret.node().extentOffsetAt(direction),
        ),
    );
  }
  return false;
}