import Fit from "./Fit";

let nodeCount: number = 0;

export interface StateNode {
  layoutChanged(): void;
}

export class DirectionNodeState<Value, T extends StateNode> {
  _id: string | number | undefined;
  _nodeFit: Fit;
  _rightToLeft: boolean;
  _scale: number;
  _value?: Value;
  _node: T;

  constructor(node: T) {
    this._id = nodeCount++;
    this._value = undefined;
    this._nodeFit = Fit.LOOSE;
    this._rightToLeft = false;
    this._scale = 1.0;
    this._node = node;
  }

  node() {
    return this._node;
  }

  id(): string | number | undefined {
    return this._id;
  }

  setId(id: string | number | undefined) {
    this._id = id;
  }

  value(): Value | undefined {
    return this._value;
  }

  setValue(newValue: Value | undefined, report?: boolean): Value | undefined {
    // console.log("Setting value to ", newValue);
    const orig = this.value();
    if (orig === newValue) {
      return orig;
    }
    const oldVal = this._value;
    this._value = newValue;
    if (arguments.length === 1 || report) {
      this.node().layoutChanged();
    }
    return this._value;
  }

  rightToLeft(): boolean {
    return this._rightToLeft;
  }

  setRightToLeft(val: boolean): void {
    this._rightToLeft = !!val;
    this.node().layoutChanged();
  }

  nodeFit(): Fit {
    return this._nodeFit;
  }

  setNodeFit(nodeFit: Fit): void {
    this._nodeFit = nodeFit;
    this.node().layoutChanged();
  }

  scale(): number {
    return this._scale;
  }

  setScale(scale: number): void {
    this._scale = scale;
    this.node().layoutChanged();
  }
}
