import { Direction } from "../Direction";

import Alignment from "./Alignment";
import AxisOverlap from "./AxisOverlap";

export default class NeighborData<T> {
  owner: T;
  direction: Direction;
  node: T | undefined;
  alignmentMode: Alignment;
  allowAxisOverlap: AxisOverlap;
  alignmentOffset: number;
  separation: number;
  lineLength: number;
  xPos: number;
  yPos: number;

  constructor(owner: T, dir: Direction) {
    this.owner = owner;
    this.direction = dir;
    this.node = undefined;
    this.alignmentMode = Alignment.NULL;
    this.alignmentOffset = 0;
    this.allowAxisOverlap = AxisOverlap.DEFAULT;
    this.separation = 0;
    this.lineLength = 0;
    this.xPos = NaN;
    this.yPos = NaN;
  }

  setNode(node: T) {
    this.node = node;
  }

  getNode(): T | undefined {
    return this.node;
  }

  getOwner(): T {
    return this.owner;
  }
}
