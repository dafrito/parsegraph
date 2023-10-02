import { DirectionNode } from "..";
import { Direction, reverseDirection } from "../../Direction";

import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";

export class Neighbor {
  private _node: DirectionNode;
  private _direction: Direction;
  private _neighbor: DirectionNode | undefined;
  private _alignment: Alignment;
  private _allowAxisOverlap: AxisOverlap;
  private _alignmentOffset: number;
  private _separation: number;
  private _lineLength: number;
  private _xPos: number;
  private _yPos: number;

  constructor(node: DirectionNode, dir: Direction) {
    this._node = node;
    this._direction = dir;
    this._neighbor = undefined;
    this._alignment = Alignment.NULL;
    this._alignmentOffset = 0;
    this._allowAxisOverlap = AxisOverlap.DEFAULT;
    this._separation = 0;
    this._lineLength = 0;
    this._xPos = NaN;
    this._yPos = NaN;
  }

  separation() {
    return this._separation;
  }

  setSeparation(separation: number) {
    this._separation = separation;
  }

  alignmentOffset() {
    return this._alignmentOffset;
  }

  setAlignmentOffset(alignmentOffset: number) {
    this._alignmentOffset = alignmentOffset;
  }

  lineLength() {
    return this._lineLength;
  }

  setLineLength(lineLength: number) {
    this._lineLength = lineLength;
  }

  axisOverlap() {
    return this._allowAxisOverlap;
  }

  setAxisOverlap(overlap: AxisOverlap) {
    this._allowAxisOverlap = overlap;
  }

  getAlignment() {
    return this._alignment;
  }

  align(alignment: Alignment) {
    this._alignment = alignment;
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
