import createException, { BAD_NODE_DIRECTION, NODE_DIRTY } from "./Exception";

import Rect from "./rect";
import Size from "./size";
import Extent from "./extent";

import Direction, { DirectionNode, reverseDirection } from "./direction";

export default class Layout {
  _extents: Extent[];
  _absoluteVersion: number;
  _absoluteDirty: boolean;
  _absoluteXPos: number;
  _absoluteYPos: number;
  _absoluteScale: number;
  _hasGroupPos: boolean;
  _groupXPos: number;
  _groupYPos: number;
  _groupScale: number;
  _owner: DirectionNode;
  _size: Size;

  constructor(owner: DirectionNode) {
    this._owner = owner;

    // Layout
    this._extents = [new Extent(), new Extent(), new Extent(), new Extent()];

    this._absoluteVersion = 0;
    this._absoluteDirty = true;
    this._absoluteXPos = null;
    this._absoluteYPos = null;
    this._absoluteScale = null;
    this._hasGroupPos = false;
    this._groupXPos = NaN;
    this._groupYPos = NaN;
    this._groupScale = NaN;

    this._size = new Size();
  }

  setOwner(owner: DirectionNode): void {
    this._owner = owner;
  }

  owner() {
    return this._owner;
  }

  commitAbsolutePos(): void {
    if (!this.needsAbsolutePos()) {
      return;
    }
    this._absoluteXPos = NaN;
    this._absoluteYPos = NaN;
    this._absoluteScale = NaN;

    // Retrieve a stack of nodes to determine the absolute position.
    let node: DirectionNode = this.owner();
    const nodeList = [];
    let parentScale = 1.0;
    let scale = 1.0;
    let neededVersion;
    if (!node.isRoot()) {
      neededVersion = node
        .parentNode()
        .findPaintGroup()
        .getLayout()._absoluteVersion;
    }
    while (true) {
      if (node.isRoot()) {
        this._absoluteXPos = 0;
        this._absoluteYPos = 0;
        break;
      }

      const par: Layout = node.nodeParent().getLayout();
      if (!par._absoluteDirty && par._absoluteVersion === neededVersion) {
        // Just use the parent's absolute position to start.
        this._absoluteXPos = par._absoluteXPos;
        this._absoluteYPos = par._absoluteYPos;
        scale = par._absoluteScale * node.state().scale();
        parentScale = par._absoluteScale;
        break;
      }

      nodeList.push(reverseDirection(node.parentDirection()));
      node = node.nodeParent();
    }

    // nodeList contains [
    //     directionToThis,
    //     directionToParent,
    //     ...,
    //     directionFromRoot
    //   ];
    for (let i = nodeList.length - 1; i >= 0; --i) {
      const directionToChild = nodeList[i];

      this._absoluteXPos += node.x() * parentScale;
      this._absoluteYPos += node.y() * parentScale;

      parentScale = scale;
      const layout = node.getLayout();
      if (layout._absoluteDirty) {
        layout._absoluteXPos = this._absoluteXPos;
        layout._absoluteYPos = this._absoluteYPos;
        layout._absoluteScale = scale;
        layout._absoluteDirty = false;
        if (!node.isRoot()) {
          layout._absoluteVersion = node
            .parentNode()
            .findPaintGroup()
            .getLayout()._absoluteVersion;
        }
      }
      scale *= node.nodeAt(directionToChild).state().scale();
      node = node.nodeAt(directionToChild);
    }

    this._absoluteXPos += node.x() * parentScale;
    this._absoluteYPos += node.y() * parentScale;
    this._absoluteScale = scale;
    this._absoluteDirty = false;
    if (!this.owner().isRoot()) {
      this._absoluteVersion = this.owner()
        .parentNode()
        .findPaintGroup()
        .getLayout()._absoluteVersion;
    }
  }

  needsAbsolutePos(): boolean {
    if (this._absoluteDirty) {
      return true;
    }
    if (this.owner().isRoot()) {
      return false;
    }
    return (
      this._absoluteVersion !==
      this.owner().parentNode().findPaintGroup().getLayout()._absoluteVersion
    );
  }

  needsPosition(): boolean {
    return this.owner().needsCommit() || !this._hasGroupPos;
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
    this._absoluteDirty = true;
  }

  commitGroupPos(): void {
    if (!this.needsPosition()) {
      return;
    }

    // Retrieve a stack of nodes to determine the group position.
    let node: DirectionNode = this.owner();
    const nodeList = [];
    let parentScale = 1.0;
    let scale = 1.0;
    while (true) {
      if (node.isRoot() || node.localPaintGroup()) {
        this._groupXPos = 0;
        this._groupYPos = 0;
        break;
      }

      const par = node.nodeParent().getLayout();
      if (!isNaN(par._groupXPos)) {
        // Just use the parent's position to start.
        this._groupXPos = par._groupXPos;
        this._groupYPos = par._groupYPos;
        scale = par._groupScale * node.state().scale();
        parentScale = par._groupScale;
        break;
      }

      nodeList.push(reverseDirection(node.parentDirection()));
      node = node.nodeParent();
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
        this._groupXPos += node.x() * parentScale;
        this._groupYPos += node.y() * parentScale;
      }

      parentScale = scale;
      scale *= node.nodeAt(directionToChild).state().scale();
      node = node.nodeAt(directionToChild);
    }
    this._groupScale = scale;

    if (!this.owner().localPaintGroup()) {
      this._groupXPos += node.x() * parentScale;
      this._groupYPos += node.y() * parentScale;
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
    if (atDirection === Direction.NULL) {
      throw createException(BAD_NODE_DIRECTION);
    }
    return this._extents[atDirection - Direction.DOWNWARD];
  }

  extentOffsetAt(atDirection: Direction): number {
    return this.extentsAt(atDirection).offset();
  }

  setExtentOffsetAt(atDirection: Direction, offset: number): void {
    this.extentsAt(atDirection).setOffset(offset);
  }

  extentSize(outPos?: Size): Size {
    if (!outPos) {
      outPos = new Size();
    }

    // We can just use the length to determine the full size.

    // The horizontal extents have length in the vertical direction.
    outPos.setHeight(this.extentsAt(Direction.FORWARD).boundingValues()[0]);

    // The vertical extents have length in the vertical direction.
    outPos.setWidth(this.extentsAt(Direction.DOWNWARD).boundingValues()[0]);

    return outPos;
  }

  groupSizeRect(rect?: Rect): Rect {
    const groupSize = this.groupSize();
    if (!rect) {
      return new Rect(
        this.groupX(),
        this.groupY(),
        groupSize.width(),
        groupSize.height()
      );
    }
    rect.setX(this.groupX());
    rect.setY(this.groupY());
    rect.setWidth(groupSize.width());
    rect.setHeight(groupSize.height());
    return rect;
  }

  absoluteSizeRect(rect?: Rect): Rect {
    const absoluteSize = this.absoluteSize();
    if (!rect) {
      return new Rect(
        this.absoluteX(),
        this.absoluteY(),
        absoluteSize.width(),
        absoluteSize.height()
      );
    }
    rect.setX(this.absoluteX());
    rect.setY(this.absoluteY());
    rect.setWidth(absoluteSize.width());
    rect.setHeight(absoluteSize.height());
    return rect;
  }

  size(bodySize?: Size): Size {
    if (bodySize) {
      bodySize.setSize(this._size.width(), this._size.height());
    }
    return this._size;
  }

  setSize(bodySize: Size) {
    this._size.setSize(bodySize.width(), bodySize.height());
  }

  absoluteSize(bodySize?: Size): Size {
    return this.size(bodySize).scaled(this.absoluteScale());
  }

  groupSize(bodySize?: Size): Size {
    bodySize = this.size(bodySize);
    bodySize.scale(this.groupScale());
    return bodySize;
  }

  inNodeBody(
    x: number,
    y: number,
    userScale: number,
    bodySize?: Size
  ): boolean {
    const s = this.size(bodySize);
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    const aScale = this.absoluteScale();
    if (x < userScale * ax - (userScale * aScale * s.width()) / 2) {
      return false;
    }
    if (x > userScale * ax + (userScale * aScale * s.width()) / 2) {
      return false;
    }
    if (y < userScale * ay - (userScale * aScale * s.height()) / 2) {
      return false;
    }
    if (y > userScale * ay + (userScale * aScale * s.height()) / 2) {
      return false;
    }
    return true;
  }

  inNodeExtents(
    x: number,
    y: number,
    userScale: number,
    extentSize?: Size
  ): boolean {
    const ax = this.absoluteX();
    const ay = this.absoluteY();
    const aScale = this.absoluteScale();
    extentSize = this.extentSize(extentSize);

    const forwardMin =
      userScale * ax -
      userScale * aScale * this.extentOffsetAt(Direction.DOWNWARD);
    if (x < forwardMin) {
      return false;
    }
    const forwardMax =
      userScale * ax -
      userScale * aScale * this.extentOffsetAt(Direction.DOWNWARD) +
      userScale * aScale * extentSize.width();
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
      userScale * aScale * extentSize.height();
    if (y > vertMax) {
      return false;
    }
    return true;
  }

  nodeUnderCoords(x: number, y: number, userScale?: number): DirectionNode {
    if (userScale === undefined) {
      userScale = 1;
    }

    const extentSize: Size = new Size();
    const candidates: DirectionNode[] = [this.owner()];

    const addCandidate = (node: DirectionNode, direction: Direction) => {
      if (direction !== undefined) {
        if (!node.hasChildAt(direction)) {
          return;
        }
        node = node.nodeAt(direction);
      }
      if (node == null) {
        return;
      }
      candidates.push(node);
    };

    const FORCE_SELECT_PRIOR: DirectionNode = null;
    while (candidates.length > 0) {
      const candidate = candidates[candidates.length - 1];

      if (candidate === FORCE_SELECT_PRIOR) {
        candidates.pop();
        return candidates.pop();
      }

      if (candidate.getLayout().inNodeBody(x, y, userScale, extentSize)) {
        if (candidate.hasNode(Direction.INWARD)) {
          if (
            candidate
              .nodeAt(Direction.INWARD)
              .getLayout()
              .inNodeExtents(x, y, userScale, extentSize)
          ) {
            candidates.push(FORCE_SELECT_PRIOR);
            candidates.push(candidate.nodeAt(Direction.INWARD));
            continue;
          }
        }

        // Found the node.
        return candidate;
      }
      // Not within this node, so remove it as a candidate.
      candidates.pop();

      // Test if the click is within any child.
      if (!candidate.getLayout().inNodeExtents(x, y, userScale, extentSize)) {
        // Nope, so continue the search.
        continue;
      }

      // It is potentially within some child, so search the children.
      const layout = candidate.getLayout();
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
