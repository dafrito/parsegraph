import { Extent } from "./Extent";

import { Direction, nameDirection, reverseDirection } from "../../Direction";
import { findPaintGroup } from "../../DirectionNode/PaintGroups/findPaintGroup";
import { DirectionNode } from "../../DirectionNode/DirectionNode";
import { LayoutPhase } from "./LayoutPhase";

export class Layout {
  private _extents: Extent[];
  private _absoluteVersion: number;
  private _absoluteDirty: boolean;
  private _absoluteXPos: number;
  private _absoluteYPos: number;
  private _absoluteScale: number;
  private _hasGroupPos: boolean;
  private _groupXPos: number;
  private _groupYPos: number;
  private _groupScale: number;
  private _node: DirectionNode;
  private _size: number[];
  private _layoutPhase: LayoutPhase;

  constructor(node: DirectionNode) {
    this._node = node;

    // Layout
    this._extents = [new Extent(), new Extent(), new Extent(), new Extent()];

    this._layoutPhase = LayoutPhase.NEEDS_COMMIT;

    this._absoluteVersion = 0;
    this._absoluteDirty = true;
    this._absoluteXPos = NaN;
    this._absoluteYPos = NaN;
    this._absoluteScale = NaN;
    this._hasGroupPos = false;
    this._groupXPos = NaN;
    this._groupYPos = NaN;
    this._groupScale = NaN;

    this._size = [NaN, NaN];
  }

  setPhase(state: LayoutPhase) {
    this._layoutPhase = state;
  }

  phase(): LayoutPhase {
    return this._layoutPhase;
  }

  needsCommit(): boolean {
    return this.phase() === LayoutPhase.NEEDS_COMMIT;
  }

  setNode(node: DirectionNode): void {
    this._node = node;
  }

  node() {
    return this._node;
  }

  commitAbsolutePos(): void {
    if (!this.needsAbsolutePos()) {
      return;
    }
    this._absoluteXPos = NaN;
    this._absoluteYPos = NaN;
    this._absoluteScale = NaN;

    // Retrieve a stack of nodes to determine the absolute position.
    let node: DirectionNode = this.node();
    const nodeList: Direction[] = [];
    let parentScale = 1.0;
    let scale = 1.0;
    let neededVersion;
    if (!node.neighbors().isRoot()) {
      neededVersion = findPaintGroup(node.neighbors().parentNode()).layout()
        ._absoluteVersion;
    }
    while (true) {
      if (node.neighbors().isRoot()) {
        this._absoluteXPos = 0;
        this._absoluteYPos = 0;
        break;
      }

      const par: Layout = node.neighbors().parentNode().layout();
      if (!par._absoluteDirty && par._absoluteVersion === neededVersion) {
        // Just use the parent's absolute position to start.
        this._absoluteXPos = par._absoluteXPos;
        this._absoluteYPos = par._absoluteYPos;
        scale = par._absoluteScale * node.scale();
        parentScale = par._absoluteScale;
        break;
      }

      nodeList.push(node.neighbors().parent().direction());
      node = node.neighbors().parentNode();
    }

    // nodeList contains [
    //     directionToThis,
    //     directionToParent,
    //     ...,
    //     directionFromRoot
    //   ];
    for (let i = nodeList.length - 1; i >= 0; --i) {
      const directionToChild = nodeList[i];

      this._absoluteXPos += node.neighbors().parentX() * parentScale;
      this._absoluteYPos += node.neighbors().parentY() * parentScale;

      parentScale = scale;
      const layout = node.layout();
      if (layout._absoluteDirty) {
        layout._absoluteXPos = this._absoluteXPos;
        layout._absoluteYPos = this._absoluteYPos;
        layout._absoluteScale = scale;
        layout._absoluteDirty = false;
        if (!node.neighbors().isRoot()) {
          layout._absoluteVersion = findPaintGroup(
            node.neighbors().parentNode()
          ).layout()._absoluteVersion;
        }
      }
      scale *= node.neighbors().nodeAt(directionToChild).scale();
      node = node.neighbors().nodeAt(directionToChild);
    }

    this._absoluteXPos += node.neighbors().parentX() * parentScale;
    this._absoluteYPos += node.neighbors().parentY() * parentScale;
    this._absoluteScale = scale;
    this._absoluteDirty = false;
    if (!this.node().neighbors().isRoot()) {
      this._absoluteVersion = findPaintGroup(
        this.node().neighbors().parentNode()
      ).layout()._absoluteVersion;
    }
  }

  needsAbsolutePos(): boolean {
    if (this._absoluteDirty) {
      return true;
    }
    if (this.node().neighbors().isRoot()) {
      return false;
    }
    return (
      this._absoluteVersion !==
      findPaintGroup(this.node().neighbors().parentNode()).layout()
        ._absoluteVersion
    );
  }

  needsPosition(): boolean {
    return this.node().layout().needsCommit() || !this._hasGroupPos;
  }

  absoluteX(): number {
    return this._absoluteXPos;
  }

  absoluteY(): number {
    return this._absoluteYPos;
  }

  absoluteScale(): number {
    return this._absoluteScale;
  }

  invalidateGroupPos(): void {
    this._hasGroupPos = false;
  }

  invalidateAbsolutePos(): void {
    if (!this._absoluteDirty) {
      ++this._absoluteVersion;
    }
    this._absoluteDirty = true;
  }

  commitGroupPos(): void {
    if (!this.needsPosition()) {
      return;
    }

    // Retrieve a stack of nodes to determine the group position.
    let node: DirectionNode = this.node();
    const nodeList: Direction[] = [];
    let parentScale = 1.0;
    let scale = 1.0;
    while (true) {
      if (node.neighbors().isRoot() || node.paintGroups().isPaintGroup()) {
        this._groupXPos = 0;
        this._groupYPos = 0;
        break;
      }

      const par = node.neighbors().parentNode().layout();
      if (!isNaN(par._groupXPos)) {
        // Just use the parent's position to start.
        this._groupXPos = par._groupXPos;
        this._groupYPos = par._groupYPos;
        scale = par._groupScale * node.scale();
        parentScale = par._groupScale;
        break;
      }

      nodeList.push(reverseDirection(node.neighbors().parent().direction()));
      node = node.neighbors().parentNode();
    }

    // nodeList contains [
    //     directionToThis,
    //     directionToParent,
    //     ...,
    //     directionFromGroupParent
    //   ];
    for (let i = nodeList.length - 1; i >= 0; --i) {
      const directionToChild = nodeList[i];

      if (i !== nodeList.length - 1) {
        this._groupXPos += node.neighbors().parentX() * parentScale;
        this._groupYPos += node.neighbors().parentY() * parentScale;
      }

      parentScale = scale;
      scale *= node.neighbors().nodeAt(directionToChild).scale();
      node = node.neighbors().nodeAt(directionToChild);
    }
    this._groupScale = scale;

    if (!this.node().paintGroups().isPaintGroup()) {
      this._groupXPos += node.neighbors().parentX() * parentScale;
      this._groupYPos += node.neighbors().parentY() * parentScale;
    }

    if (isNaN(this._groupXPos)) {
      throw new Error("Calculated NaN group X pos");
    }
    if (isNaN(this._groupYPos)) {
      throw new Error("Calculated NaN group Y pos");
    }
    if (isNaN(this._groupScale)) {
      throw new Error("Calculated NaN group scale");
    }

    this._hasGroupPos = true;
  }

  groupX(): number {
    return this._groupXPos;
  }

  groupY(): number {
    return this._groupYPos;
  }

  groupScale(): number {
    return this._groupScale;
  }

  extentsAt(atDirection: Direction): Extent {
    const rv = this._extents[atDirection - Direction.DOWNWARD];
    if (rv === undefined) {
      throw new Error(
        "No extents for direction: " + nameDirection(atDirection)
      );
    }
    return rv;
  }

  extentOffsetAt(atDirection: Direction): number {
    return this.extentsAt(atDirection).offset();
  }

  setExtentOffsetAt(atDirection: Direction, offset: number): void {
    this.extentsAt(atDirection).setOffset(offset);
  }

  extentSize(outPos: number[]): void {
    // We can just use the length to determine the full size.

    // The horizontal extents have length in the vertical direction.
    outPos[1] = this.extentsAt(Direction.FORWARD).boundingValues()[0];

    // The vertical extents have length in the vertical direction.
    outPos[0] = this.extentsAt(Direction.DOWNWARD).boundingValues()[0];
  }

  groupSizeRect(rect: number[]): void {
    this.groupSize(rect);
    rect[2] = rect[0];
    rect[3] = rect[1];
    rect[0] = this.groupX();
    rect[1] = this.groupY();
  }

  absoluteSizeRect(rect: number[]): void {
    this.absoluteSize(rect);
    rect[2] = rect[0];
    rect[3] = rect[1];
    rect[0] = this.absoluteX();
    rect[1] = this.absoluteY();
  }

  size(bodySize: number[]): void {
    if (bodySize) {
      bodySize[0] = this._size[0];
      bodySize[1] = this._size[1];
    }
  }

  setSize(bodySize: number[]) {
    this._size[0] = bodySize[0];
    this._size[1] = bodySize[1];
  }

  absoluteSize(bodySize: number[]): void {
    this.size(bodySize);
    const absScale = this.absoluteScale();
    bodySize[0] *= absScale;
    bodySize[1] *= absScale;
  }

  groupSize(bodySize: number[]): void {
    const groupScale = this.groupScale();
    bodySize[0] = this._size[0] * groupScale;
    bodySize[1] = this._size[1] * groupScale;
  }

  inNodeBody(
    x: number,
    y: number,
    userScale: number,
    bodySize: number[]
  ): boolean {
    this.size(bodySize);
    const s = bodySize;
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    const aScale = this.absoluteScale();
    if (x < userScale * ax - (userScale * aScale * s[0]) / 2) {
      return false;
    }
    if (x > userScale * ax + (userScale * aScale * s[0]) / 2) {
      return false;
    }
    if (y < userScale * ay - (userScale * aScale * s[1]) / 2) {
      return false;
    }
    if (y > userScale * ay + (userScale * aScale * s[1]) / 2) {
      return false;
    }
    return true;
  }

  inNodeExtents(
    x: number,
    y: number,
    userScale: number,
    extentSize: number[]
  ): boolean {
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    const aScale = this.absoluteScale();
    this.extentSize(extentSize);

    const forwardMin =
      userScale * ax -
      userScale * aScale * this.extentOffsetAt(Direction.DOWNWARD);
    if (x < forwardMin) {
      return false;
    }
    const forwardMax =
      userScale * ax -
      userScale * aScale * this.extentOffsetAt(Direction.DOWNWARD) +
      userScale * aScale * extentSize[0];
    if (x > forwardMax) {
      return false;
    }
    const vertMin =
      userScale * ay -
      userScale * aScale * this.extentOffsetAt(Direction.FORWARD);
    if (y < vertMin) {
      return false;
    }
    const vertMax =
      userScale * ay -
      userScale * aScale * this.extentOffsetAt(Direction.FORWARD) +
      userScale * aScale * extentSize[1];
    if (y > vertMax) {
      return false;
    }
    return true;
  }

  nodeUnderCoords(
    x: number,
    y: number,
    userScale?: number
  ): DirectionNode | null {
    if (userScale === undefined) {
      userScale = 1;
    }

    const extentSize: number[] = [NaN, NaN];
    const candidates: DirectionNode[] = [this.node()];

    const addCandidate = (node: DirectionNode, direction: Direction) => {
      if (direction !== undefined) {
        if (!node.neighbors().hasChildAt(direction)) {
          return;
        }
        node = node.neighbors().nodeAt(direction);
      }
      if (node == null) {
        return;
      }
      candidates.push(node);
    };

    const FORCE_SELECT_PRIOR: DirectionNode | null = null;
    while (candidates.length > 0) {
      const candidate = candidates[candidates.length - 1];

      if (candidate === FORCE_SELECT_PRIOR) {
        candidates.pop();
        return candidates.pop() ?? null;
      }

      if (candidate.layout().inNodeBody(x, y, userScale, extentSize)) {
        if (candidate.neighbors().hasNode(Direction.INWARD)) {
          if (
            candidate
              .neighbors()
              .nodeAt(Direction.INWARD)
              .layout()
              .inNodeExtents(x, y, userScale, extentSize)
          ) {
            candidates.push(FORCE_SELECT_PRIOR as any);
            candidates.push(candidate.neighbors().nodeAt(Direction.INWARD));
            continue;
          }
        }

        // Found the node.
        return candidate;
      }
      // Not within this node, so remove it as a candidate.
      candidates.pop();

      // Test if the click is within any child.
      if (!candidate.layout().inNodeExtents(x, y, userScale, extentSize)) {
        // Nope, so continue the search.
        continue;
      }

      // It is potentially within some child, so search the children.
      const layout = candidate.layout();
      if (
        Math.abs(y - userScale * layout.absoluteY()) >
        Math.abs(x - userScale * layout.absoluteX())
      ) {
        // Y extent is greater than X extent.
        if (userScale * layout.absoluteX() > x) {
          addCandidate(candidate, Direction.BACKWARD);
          addCandidate(candidate, Direction.FORWARD);
        } else {
          addCandidate(candidate, Direction.FORWARD);
          addCandidate(candidate, Direction.BACKWARD);
        }
        if (userScale * layout.absoluteY() > y) {
          addCandidate(candidate, Direction.UPWARD);
          addCandidate(candidate, Direction.DOWNWARD);
        } else {
          addCandidate(candidate, Direction.DOWNWARD);
          addCandidate(candidate, Direction.UPWARD);
        }
      } else {
        // X extent is greater than Y extent.
        if (userScale * layout.absoluteY() > y) {
          addCandidate(candidate, Direction.UPWARD);
          addCandidate(candidate, Direction.DOWNWARD);
        } else {
          addCandidate(candidate, Direction.DOWNWARD);
          addCandidate(candidate, Direction.UPWARD);
        }
        if (userScale * layout.absoluteX() > x) {
          addCandidate(candidate, Direction.BACKWARD);
          addCandidate(candidate, Direction.FORWARD);
        } else {
          addCandidate(candidate, Direction.FORWARD);
          addCandidate(candidate, Direction.BACKWARD);
        }
      }
    }

    return null;
  }

  dumpExtentBoundingRect(): void {
    // extent.boundingValues() returns [totalLength, minSize, maxSize]
    const backwardOffset: number = this.extentOffsetAt(Direction.BACKWARD);
    this.extentsAt(Direction.BACKWARD).dump(
      "Backward extent (center at " + backwardOffset + ")"
    );

    const forwardOffset: number = this.extentOffsetAt(Direction.FORWARD);
    this.extentsAt(Direction.FORWARD).dump(
      "Forward extent (center at " + forwardOffset + ")"
    );

    const downwardOffset: number = this.extentOffsetAt(Direction.DOWNWARD);
    this.extentsAt(Direction.DOWNWARD).dump(
      "Downward extent (center at " + downwardOffset + ")"
    );

    const upwardOffset: number = this.extentOffsetAt(Direction.UPWARD);
    this.extentsAt(Direction.UPWARD).dump(
      "Upward extent (center at " + upwardOffset + ")"
    );
  }
}
