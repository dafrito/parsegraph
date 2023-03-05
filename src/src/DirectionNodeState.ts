import Fit from "./Fit";

let nodeCount: number = 0;

interface StateNode {
  layoutChanged(): void;
}

export default class DirectionNodeState<Value, T extends StateNode> {
  _id: string | number;
  _nodeFit: Fit;
  _rightToLeft: boolean;
  _scale: number;
  _value: Value;
  _node: T;

  constructor(node: T) {
    this._node = node;
    this._id = nodeCount++;
    this._value = null;
    this._nodeFit = Fit.LOOSE;
    this._rightToLeft = false;
    this._scale = 1.0;
  }

  node() {
    return this._node;
  }

  id(): string | number {
    return this._id;
  }

  setId(id: string | number) {
    this._id = id;
  }

  value(): Value {
    return this._value;
  }

  setValue(newValue: Value, report?: boolean): void {
    // console.log("Setting value to ", newValue);
    const orig = this.value();
    if (orig === newValue) {
      return;
    }
    this._value = newValue;
    if (arguments.length === 1 || report) {
      this.node().layoutChanged();
    }
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
