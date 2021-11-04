import Direction, { Axis } from "parsegraph-direction";
import Size from "parsegraph-size";
import Alignment from "./Alignment";
import LayoutNode from "./LayoutNode";

export interface LayoutNodeStyle {
  minWidth: number;
  minHeight: number;
  borderThickness: number;
  verticalPadding: number;
  horizontalPadding: number;
  verticalSeparation: number;
  horizontalSeparation: number;
}

export default class BasicLayoutNode extends LayoutNode {
  _minHeight: number;
  _minWidth: number;
  _borderThickness: number;
  _verticalPadding: number;
  _horizontalPadding: number;
  _verticalSeparation: number;
  _horizontalSeparation: number;

  setBlockStyle(style: LayoutNodeStyle) {
    this._minHeight = style.minHeight;
    this._minWidth = style.minWidth;
    this._borderThickness = style.borderThickness;
    this._verticalPadding = style.verticalPadding;
    this._horizontalPadding = style.horizontalPadding;
    this._verticalSeparation = style.verticalSeparation;
    this._horizontalSeparation = style.horizontalSeparation;
    this.layoutWasChanged(Direction.INWARD);
  }

  blockStyle(): LayoutNodeStyle {
    return {
      minHeight: this._minHeight,
      minWidth: this._minWidth,
      borderThickness: this._borderThickness,
      verticalPadding: this._verticalPadding,
      horizontalPadding: this._horizontalPadding,
      verticalSeparation: this._verticalSeparation,
      horizontalSeparation: this._horizontalSeparation,
    };
  }

  size(bodySize?: Size): Size {
    if (!bodySize) {
      bodySize = new Size();
    }
    bodySize.setHeight(
      this._borderThickness * 2 + this._verticalPadding * 2 + this._minHeight
    );
    bodySize.setWidth(
      this._borderThickness * 2 + this._horizontalPadding * 2 + this._minWidth
    );
    return bodySize;
  }

  getSeparation(axis: Axis): number {
    switch (axis) {
      case Axis.VERTICAL:
        return this._verticalSeparation;
      case Axis.HORIZONTAL:
        return this._horizontalSeparation;
      case Axis.Z:
        if (
          this.nodeAlignmentMode(Direction.INWARD) === Alignment.INWARD_VERTICAL
        ) {
          return this._verticalPadding - this._borderThickness;
        }
        return this._horizontalPadding - this._borderThickness;
    }
    return 0;
  }
}
