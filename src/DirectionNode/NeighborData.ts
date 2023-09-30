import { Direction, reverseDirection } from "../Direction";

import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";

export class NeighborData<T> {
  private _node: T;
  private _direction: Direction;
  private _neighbor: T | undefined;
  alignmentMode: Alignment;
  allowAxisOverlap: AxisOverlap;
  alignmentOffset: number;
  separation: number;
  lineLength: number;
  xPos: number;
  yPos: number;

  constructor(node: T, dir: Direction) {
    this._node = node;
    this._direction = dir;
    this._neighbor = undefined;
    this.alignmentMode = Alignment.NULL;
    this.alignmentOffset = 0;
    this.allowAxisOverlap = AxisOverlap.DEFAULT;
    this.separation = 0;
    this.lineLength = 0;
    this.xPos = NaN;
    this.yPos = NaN;
  }

  direction(): Direction {
    return this._direction;
  }

  reverseDirection(): Direction {
    return reverseDirection(this._direction);
  }

  meet(newNeighbor: T) {
    this._neighbor = newNeighbor;
  }

  leave() {
    this._neighbor = undefined;
  }

  neighbor(): T | undefined {
    return this._neighbor;
  }

  node(): T {
    return this._node;
  }
}
