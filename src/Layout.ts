import createException, { BAD_NODE_DIRECTION, NODE_DIRTY } from "./Exception";

import CommitLayoutData from "./CommitLayoutData";

import Rect from "./rect";
import Size from "parsegraph-size";
import Extent from "./extent";

import LayoutNode from "./LayoutNode";

import { log, logc, logEnterc, logLeave } from "./log";

import Direction, {
  Axis,
  reverseDirection,
  isVerticalDirection,
} from "./src";

import AutocommitBehavior, { getAutocommitBehavior } from "./autocommit";

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
  _owner: LayoutNode;

  constructor(owner: LayoutNode) {
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
  }

  setOwner(owner: LayoutNode): void {
    this._owner = owner;
  }

  owner() {
    return this._owner;
  }

  horizontalSeparation(dir: Direction): number {
    return this.owner().value().getSeparation(Axis.HORIZONTAL, dir, false);
  }

  verticalSeparation(dir: Direction): number {
    return this.owner().value().getSeparation(Axis.VERTICAL, dir, false);
  }

  autocommitAbsolutePos(): void {
    if (getAutocommitBehavior() === AutocommitBehavior.THROW) {
      throw createException(NODE_DIRTY);
    }
    this.commitAbsolutePos();
  }

  autocommitLayoutIteratively(): void {
    if (getAutocommitBehavior() === AutocommitBehavior.THROW) {
      throw createException(NODE_DIRTY);
    }
    this.commitLayoutIteratively();
  }

  commitAbsolutePos(): void {
    if (!this.needsAbsolutePos()) {
      logc(
        "Layout",
        "{0} does not need an absolute version update, so just return.",
        this.owner().state().id()
      );
      return;
    }
    logEnterc(
      "Layout",
      "{0} needs an absolute version update",
      this.owner().state().id()
    );
    this._absoluteXPos = null;
    this._absoluteYPos = null;
    this._absoluteScale = null;

    // Retrieve a stack of nodes to determine the absolute position.
    let node: LayoutNode = this.owner();
    const nodeList = [];
    let parentScale = 1.0;
    let scale = 1.0;
    let neededVersion;
    if (!node.isRoot()) {
      neededVersion = node
        .parentNode()
        .findPaintGroup()
        .value()
        .getLayout()._absoluteVersion;
    }
    while (true) {
      if (node.isRoot()) {
        this._absoluteXPos = 0;
        this._absoluteYPos = 0;
        break;
      }

      const par: Layout = node.nodeParent().value().getLayout();
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
      const layout = node.value().getLayout();
      if (layout._absoluteDirty) {
        layout._absoluteXPos = this._absoluteXPos;
        layout._absoluteYPos = this._absoluteYPos;
        layout._absoluteScale = scale;
        layout._absoluteDirty = false;
        if (!node.isRoot()) {
          layout._absoluteVersion = node
            .parentNode()
            .findPaintGroup()
            .value()
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
    logc(
      "Layout",
      "{0} has absolute pos {1}, {2}. scale={3}",
      this.owner().state().id(),
      this._absoluteXPos,
      this._absoluteYPos,
      this._absoluteScale
    );
    if (!this.owner().isRoot()) {
      this._absoluteVersion = this.owner()
        .parentNode()
        .findPaintGroup()
        .value()
        .getLayout()._absoluteVersion;
    }
    logLeave();
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
      this.owner().parentNode().findPaintGroup().value().getLayout()
        ._absoluteVersion
    );
  }

  needsPosition(): boolean {
    return this.owner().needsCommit() || !this._hasGroupPos;
  }

  absoluteX(): number {
    if (this.owner().findPaintGroup().value().getLayout().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    this.autocommitAbsolutePos();
    return this._absoluteXPos;
  }

  absoluteY(): number {
    if (this.owner().findPaintGroup().value().getLayout().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    this.autocommitAbsolutePos();
    return this._absoluteYPos;
  }

  absoluteScale(): number {
    if (this.owner().findPaintGroup().value().getLayout().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    this.autocommitAbsolutePos();
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
      logc(
        "Layout",
        "{0} does not need a group position update.",
        this.owner().state().id()
      );
      return;
    }

    logEnterc(
      "Layout",
      "{0} needs a group position update.",
      this.owner().state().id()
    );

    // Retrieve a stack of nodes to determine the group position.
    let node: LayoutNode = this.owner();
    const nodeList = [];
    let parentScale = 1.0;
    let scale = 1.0;
    while (true) {
      if (node.isRoot() || node.localPaintGroup()) {
        log(node.isRoot() ? "Node is root" : "Node is a paint group root");
        this._groupXPos = 0;
        this._groupYPos = 0;
        break;
      }

      const par = node.nodeParent().value().getLayout();
      if (par._groupXPos !== null) {
        // Just use the parent's position to start.
        this._groupXPos = par._groupXPos;
        this._groupYPos = par._groupYPos;
        scale = par._groupScale * node.state().scale();
        parentScale = par._groupScale;
        log(
          "Using parent pos {0}, {1}. scale={2}",
          this._groupXPos,
          this._groupYPos,
          scale
        );
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
    logc(
      "Scale assignments",
      "Assigning scale for {0} to {1}",
      this.owner().state().id(),
      scale
    );
    this._groupScale = scale;

    if (!this.owner().localPaintGroup()) {
      log(
        "Node is not a paint group root, so adding local x={0} and y={1}",
        node.x() * parentScale,
        node.y() * parentScale
      );
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
    logLeave();
  }

  groupX(): number {
    if (this.owner().findPaintGroup().value().getLayout().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    if (this._groupXPos === null || isNaN(this._groupXPos)) {
      throw new Error("Group X position must not be " + this._groupXPos);
    }
    return this._groupXPos;
  }

  groupY(): number {
    if (this.owner().findPaintGroup().value().getLayout().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    return this._groupYPos;
  }

  groupScale(): number {
    if (this.owner().findPaintGroup().value().getLayout().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    return this._groupScale;
  }

  commitLayoutIteratively(timeout?: number): Function {
    if (!this.owner().isRoot()) {
      return this.owner()
        .root()
        .value()
        .getLayout()
        .commitLayoutIteratively(timeout);
    }

    const cld = new CommitLayoutData(this.owner(), timeout);
    return cld.commitLayoutLoop(timeout);
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

    // console.log("Extent Size = " + outPos.width() + " " + outPos.height());

    return outPos;
  }

  sizeIn(direction: Direction, bodySize?: Size): number {
    const rv = this.size(bodySize);
    if (isVerticalDirection(direction)) {
      return rv.height() / 2;
    } else {
      return rv.width() / 2;
    }
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
    return this.owner().value().size(bodySize);
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
      logc(
        "Hit tests",
        "Given coords are outside this node's body. (Horizontal minimum exceeds X-coord)"
      );
      return false;
    }
    if (x > userScale * ax + (userScale * aScale * s.width()) / 2) {
      logc(
        "Hit tests",
        "Given coords are outside this node's body. (X-coord exceeds horizontal maximum)"
      );
      return false;
    }
    if (y < userScale * ay - (userScale * aScale * s.height()) / 2) {
      logc(
        "Hit tests",
        "Given coords are outside this node's body. (Vertical minimum exceeds Y-coord)"
      );
      return false;
    }
    if (y > userScale * ay + (userScale * aScale * s.height()) / 2) {
      logc(
        "Hit tests",
        "Given coords are outside this node's body. (Y-coord exceeds vertical maximum)"
      );
      return false;
    }
    logc("Hit tests", "Within body of node {0}", this.owner().state().id());
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

    // console.log("Checking node extent of size (" + extentSize[0] + ", " +
    //   extentSize[1] + ") at absolute X, Y origin of " + ax + ", " + ay");
    if (aScale != 1) {
      // console.log("Node absolute scale is " + aScale);
    }
    if (userScale != 1) {
      // console.log("User scale is " + userScale);
    }
    // console.log("Position to test is (" + x + ", " + y + ")");

    // this.dump();
    const forwardMin =
      userScale * ax -
      userScale * aScale * this.extentOffsetAt(Direction.DOWNWARD);
    if (x < forwardMin) {
      // console.log("Test X value of " + x +
      //   " is behind horizontal node minimum of " + forwardMin + ".");
      return false;
    }
    const forwardMax =
      userScale * ax -
      userScale * aScale * this.extentOffsetAt(Direction.DOWNWARD) +
      userScale * aScale * extentSize.width();
    // console.log("ForwardMax = " + forwardMax + " = ax=" +
    //   this.absoluteX() + " - offset=" + this.extentOffsetAt(DOWNWARD) +
    //   " + width=" + extentSize.width());
    if (x > forwardMax) {
      // console.log("Test X value of " + x +
      //   " is ahead of horizontal node maximum of " + forwardMax + ".");
      return false;
    }
    const vertMin =
      userScale * ay -
      userScale * aScale * this.extentOffsetAt(Direction.FORWARD);
    if (y < vertMin) {
      // console.log("Test Y value of " + y +
      //   " is above node vertical minimum of " + vertMin + ".");
      return false;
    }
    const vertMax =
      userScale * ay -
      userScale * aScale * this.extentOffsetAt(Direction.FORWARD) +
      userScale * aScale * extentSize.height();
    if (y > vertMax) {
      // console.log("Test Y value of " + y +
      //   " is beneath node vertical maximum of " + vertMax + ".");
      return false;
    }
    // console.log("Test value is in within node extent.");
    return true;
  }

  nodeUnderCoords(x: number, y: number, userScale?: number): LayoutNode {
    // console.log("nodeUnderCoords: " + x + ", " + y)
    if (userScale === undefined) {
      userScale = 1;
    }

    const extentSize: Size = new Size();
    const candidates: LayoutNode[] = [this.owner()];

    const addCandidate = (node: LayoutNode, direction: Direction) => {
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

    const FORCE_SELECT_PRIOR: LayoutNode = null;
    while (candidates.length > 0) {
      const candidate = candidates[candidates.length - 1];
      // console.log("Checking node " +
      //   candidate._id + " = " + candidate.label());

      if (candidate === FORCE_SELECT_PRIOR) {
        candidates.pop();
        return candidates.pop();
      }

      if (
        candidate.value().getLayout().inNodeBody(x, y, userScale, extentSize)
      ) {
        // console.log("Click is in node body");
        if (candidate.hasNode(Direction.INWARD)) {
          if (
            candidate
              .nodeAt(Direction.INWARD)
              .value()
              .getLayout()
              .inNodeExtents(x, y, userScale, extentSize)
          ) {
            // console.log("Testing inward node");
            candidates.push(FORCE_SELECT_PRIOR);
            candidates.push(candidate.nodeAt(Direction.INWARD));
            continue;
          } else {
            // console.log("Click not in inward extents");
          }
        }

        // Found the node.
        // console.log("Mouse under node " + candidate._id);
        return candidate;
      }
      // Not within this node, so remove it as a candidate.
      candidates.pop();

      // Test if the click is within any child.
      if (
        !candidate
          .value()
          .getLayout()
          .inNodeExtents(x, y, userScale, extentSize)
      ) {
        // Nope, so continue the search.
        // console.log("Click is not in node extents.");
        continue;
      }
      // console.log("Click is in node extent");

      // It is potentially within some child, so search the children.
      const layout = candidate.value().getLayout();
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

    // console.log("Found nothing.");
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

    /*
        let backwardValues:[number, number, number] =
          this.extentsAt(Direction.BACKWARD).boundingValues();
        let forwardValues:[number, number, number] =
          this.extentsAt(Direction.FORWARD).boundingValues();
        let downwardValues:[number, number, number] =
          this.extentsAt(Direction.DOWNWARD).boundingValues();
        let upwardValues:[number, number, number] =
          this.extentsAt(Direction.UPWARD).boundingValues();
        log("Backward values: " + backwardValues);
        log("Forward values: " + forwardValues);
        log("Upward values: " + upwardValues);
        log("Downward values: " + downwardValues);
        */
  }
}
