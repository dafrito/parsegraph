import { DirectionNode } from "..";
import { Direction, reverseDirection } from "../../Direction";

import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";

export class Neighbor {
  private _node: DirectionNode;
  private _direction: Direction;
  private _neighbor: DirectionNode | undefined;
  alignmentMode: Alignment;
  allowAxisOverlap: AxisOverlap;
  alignmentOffset: number;
  separation: number;
  lineLength: number;
  private _xPos: number;
  private _yPos: number;

  constructor(node: DirectionNode, dir: Direction) {
    this._node = node;
    this._direction = dir;
    this._neighbor = undefined;
    this.alignmentMode = Alignment.NULL;
    this.alignmentOffset = 0;
    this.allowAxisOverlap = AxisOverlap.DEFAULT;
    this.separation = 0;
    this.lineLength = 0;
    this._xPos = NaN;
    this._yPos = NaN;
  }

  xPos() {
    return this._xPos;
  }

  yPos() {
    return this._yPos;
  }

  setPos(x: number, y: number): void {
    this._xPos = x;
    this._yPos = y;
  }

  direction(): Direction {
    return this._direction;
  }

  reverseDirection(): Direction {
    return reverseDirection(this._direction);
  }

  meet(newNeighbor: DirectionNode) {
    this._neighbor = newNeighbor;
  }

  leave() {
    this._neighbor = undefined;
  }

  neighbor(): DirectionNode | undefined {
    return this._neighbor;
  }

  node(): DirectionNode {
    return this._node;
  }
}
