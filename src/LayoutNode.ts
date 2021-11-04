import createException, {
  BAD_NODE_DIRECTION,
  NO_NODE_FOUND,
  NODE_DIRTY,
} from "./Exception";

import CommitLayoutData from "./CommitLayoutData";

import Rect from "parsegraph-rect";
import Size from "parsegraph-size";
import Extent from "parsegraph-extent";

import Direction, {
  NeighborData,
  DirectionNode,
  reverseDirection,
  isVerticalDirection,
  isCardinalDirection,
  Axis,
} from "parsegraph-direction";

import Fit from "./Fit";
import AxisOverlap from "./AxisOverlap";
import Alignment from "./Alignment";

// ////////////////////////////////////////////////////////////////////////////
//
// Node
//
// ////////////////////////////////////////////////////////////////////////////

export class TypedNeighborData extends NeighborData {
  alignmentMode: Alignment;
  allowAxisOverlap: AxisOverlap;
  alignmentOffset: number;
  separation: number;
  lineLength: number;
  xPos: number;
  yPos: number;

  constructor(owner: LayoutNode, dir: Direction) {
    super(owner, dir);
    this.alignmentMode = Alignment.NULL;
    this.allowAxisOverlap = AxisOverlap.DEFAULT;
    this.alignmentOffset = 0;
    this.separation = 0;
    this.lineLength = 0;
    this.xPos = null;
    this.yPos = null;
  }

  getNode(): LayoutNode {
    return this.node as LayoutNode;
  }

  getOwner(): LayoutNode {
    return this.owner as LayoutNode;
  }
}

import AutocommitBehavior, { getAutocommitBehavior } from "./autocommit";

export default abstract class LayoutNode extends DirectionNode {
  _rightToLeft: boolean;
  _scale: number;
  _extents: Extent[];
  _nodeFit: Fit;
  _absoluteVersion: number;
  _absoluteDirty: boolean;
  _absoluteXPos: number;
  _absoluteYPos: number;
  _absoluteScale: number;
  _hasGroupPos: boolean;
  _groupXPos: number;
  _groupYPos: number;
  _groupScale: number;

  constructor(fromNode?: LayoutNode, parentDirection?: Direction) {
    super(fromNode, parentDirection);
    this._rightToLeft = false;
    this._scale = 1.0;

    // Layout
    this._extents = [new Extent(), new Extent(), new Extent(), new Extent()];

    this._nodeFit = Fit.LOOSE;
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

  abstract size(bodySize?: Size): Size;

  abstract getSeparation(axis: Axis, dir: Direction): number;

  innerSeparation(dir: Direction): number {
    return this.getSeparation(Axis.Z, dir);
  }

  horizontalSeparation(dir: Direction): number {
    return this.getSeparation(Axis.HORIZONTAL, dir);
  }

  verticalSeparation(dir: Direction): number {
    return this.getSeparation(Axis.VERTICAL, dir);
  }

  parentNeighbor(): TypedNeighborData {
    return this._parentNeighbor as TypedNeighborData;
  }

  createNeighborData(inDirection: Direction): NeighborData {
    return new TypedNeighborData(this, inDirection);
  }

  toString(): string {
    return "[LayoutNode " + this._id + "]";
  }

  x(): number {
    if (this.isRoot()) {
      return 0;
    }
    return this.parentNeighbor().xPos;
  }

  y(): number {
    if (this.isRoot()) {
      return 0;
    }
    return this.parentNeighbor().yPos;
  }

  scale(): number {
    return this._scale;
  }

  setScale(scale: number): void {
    this._scale = scale;
    this.layoutWasChanged(Direction.INWARD);
  }

  setRightToLeft(val: boolean): void {
    this._rightToLeft = !!val;
    this.layoutWasChanged(Direction.INWARD);
  }

  rightToLeft(): boolean {
    return this._rightToLeft;
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

  needsAbsolutePos(): boolean {
    return (
      !this._absoluteDirty &&
      !this.isRoot() &&
      this._absoluteVersion ===
        this.parentNode().findPaintGroup()._absoluteVersion
    );
  }

  commitAbsolutePos(): void {
    if (this.needsAbsolutePos()) {
      // console.log(this +
      //   " does not need an absolute version update, so just return.");
      return;
    }
    // console.log(this + " needs an absolute version update");
    this._absoluteXPos = null;
    this._absoluteYPos = null;
    this._absoluteScale = null;

    // Retrieve a stack of nodes to determine the absolute position.
    let node: LayoutNode = this;
    const nodeList = [];
    let parentScale = 1.0;
    let scale = 1.0;
    let neededVersion;
    if (!this.isRoot()) {
      neededVersion = this.parentNode().findPaintGroup()._absoluteVersion;
    }
    while (true) {
      if (node.isRoot()) {
        this._absoluteXPos = 0;
        this._absoluteYPos = 0;
        break;
      }

      const par = node.nodeParent();
      if (!par._absoluteDirty && par._absoluteVersion === neededVersion) {
        // Just use the parent's absolute position to start.
        this._absoluteXPos = par._absoluteXPos;
        this._absoluteYPos = par._absoluteYPos;
        scale = par._absoluteScale * node.scale();
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
      if (node._absoluteDirty) {
        node._absoluteXPos = this._absoluteXPos;
        node._absoluteYPos = this._absoluteYPos;
        node._absoluteScale = scale;
        node._absoluteDirty = false;
        if (!node.isRoot()) {
          node._absoluteVersion = node
            .parentNode()
            .findPaintGroup()._absoluteVersion;
        }
      }
      scale *= node.scaleAt(directionToChild);
      node = node.nodeAt(directionToChild);
    }

    // console.log(this +
    //   " has absolute pos " + this._absoluteXPos + ", " + this._absoluteYPos);
    this._absoluteXPos += node.x() * parentScale;
    this._absoluteYPos += node.y() * parentScale;
    this._absoluteScale = scale;
    this._absoluteDirty = false;
    if (!this.isRoot()) {
      this._absoluteVersion = this.parentNode().findPaintGroup()._absoluteVersion;
    }
  }

  needsPosition(): boolean {
    return this.needsCommit() || !this._hasGroupPos;
  }

  absoluteX(): number {
    if (this.findPaintGroup().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    this.autocommitAbsolutePos();
    return this._absoluteXPos;
  }

  absoluteY(): number {
    if (this.findPaintGroup().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    this.autocommitAbsolutePos();
    return this._absoluteYPos;
  }

  absoluteScale(): number {
    if (this.findPaintGroup().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    this.autocommitAbsolutePos();
    return this._absoluteScale;
  }

  commitGroupPos(): void {
    if (this._hasGroupPos) {
      // console.log(this + " does not need a position update.");
      return;
    }

    // Retrieve a stack of nodes to determine the group position.
    let node: LayoutNode = this;
    const nodeList = [];
    let parentScale = 1.0;
    let scale = 1.0;
    while (true) {
      if (node.isRoot() || node.localPaintGroup()) {
        this._groupXPos = 0;
        this._groupYPos = 0;
        break;
      }

      const par = node.nodeParent();
      if (par._groupXPos !== null) {
        // Just use the parent's position to start.
        this._groupXPos = par._groupXPos;
        this._groupYPos = par._groupYPos;
        scale = par._groupScale * node.scale();
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
      scale *= node.scaleAt(directionToChild);
      node = node.nodeAt(directionToChild);
    }
    // console.log("Assigning scale for " + this + " to " + scale);
    this._groupScale = scale;

    if (!this.localPaintGroup()) {
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
    if (this.findPaintGroup().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    if (this._groupXPos === null || isNaN(this._groupXPos)) {
      throw new Error("Group X position must not be " + this._groupXPos);
    }
    return this._groupXPos;
  }

  groupY(): number {
    if (this.findPaintGroup().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    return this._groupYPos;
  }

  groupScale(): number {
    if (this.findPaintGroup().needsPosition()) {
      this.autocommitLayoutIteratively();
    }
    return this._groupScale;
  }

  setPosAt(inDirection: Direction, x: number, y: number): void {
    this.neighborAt(inDirection).xPos = x;
    this.neighborAt(inDirection).yPos = y;
  }

  nodeFit(): Fit {
    return this._nodeFit;
  }

  setNodeFit(nodeFit: Fit): void {
    this._nodeFit = nodeFit;
    this.layoutWasChanged(Direction.INWARD);
  }

  invalidateLayout(): void {
    super.invalidateLayout();
    this._hasGroupPos = false;
  }

  connectNode(inDirection: Direction, node: this): this {
    // Allow alignments to be set before children are spawned.
    const neighbor = this.ensureNeighbor(inDirection);
    if (neighbor.alignmentMode == Alignment.NULL) {
      neighbor.alignmentMode = Alignment.NONE;
    }

    return super.connectNode(inDirection, node);
  }

  commitLayoutIteratively(timeout?: number): Function {
    if (!this.isRoot()) {
      return this.root().commitLayoutIteratively(timeout);
    }

    const cld = new CommitLayoutData(this, timeout);
    return cld.commitLayoutLoop(timeout);
  }

  scaleAt(direction: Direction): number {
    return this.nodeAt(direction).scale();
  }

  lineLengthAt(direction: Direction): number {
    if (!this.hasNode(direction)) {
      return 0;
    }
    return this.neighborAt(direction).lineLength;
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

  setNodeAlignmentMode(
    inDirection: Direction | Alignment,
    newAlignmentMode?: Alignment
  ): void {
    if (newAlignmentMode === undefined) {
      return this.parentNode().setNodeAlignmentMode(
        reverseDirection(this.parentDirection()),
        inDirection as Alignment
      );
    }
    this.ensureNeighbor(
      inDirection as Direction
    ).alignmentMode = newAlignmentMode;
    // console.log(nameNodeAlignment(newAlignmentMode));
    this.layoutWasChanged(inDirection as Direction);
  }

  nodeAlignmentMode(inDirection: Direction): Alignment {
    if (this.hasNode(inDirection)) {
      return this.neighborAt(inDirection).alignmentMode;
    }
    return Alignment.NULL;
  }

  setAxisOverlap(
    inDirection: Direction | AxisOverlap,
    newAxisOverlap?: AxisOverlap
  ): void {
    if (newAxisOverlap === undefined) {
      return this.parentNode().setAxisOverlap(
        reverseDirection(this.parentDirection()),
        inDirection as AxisOverlap
      );
    }
    this.ensureNeighbor(
      inDirection as Direction
    ).allowAxisOverlap = newAxisOverlap;
    this.layoutWasChanged(inDirection as Direction);
  }

  axisOverlap(inDirection?: Direction): AxisOverlap {
    if (inDirection === undefined) {
      return this.parentNode().axisOverlap(
        reverseDirection(this.parentDirection())
      );
    }
    if (this.hasNode(inDirection)) {
      return this.neighborAt(inDirection).allowAxisOverlap;
    }
    return AxisOverlap.NULL;
  }

  sizeIn(direction: Direction, bodySize?: Size): number {
    const rv = this.size(bodySize);
    if (isVerticalDirection(direction)) {
      return rv.height() / 2;
    } else {
      return rv.width() / 2;
    }
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

  absoluteSize(bodySize?: Size): Size {
    return this.size(bodySize).scaled(this.absoluteScale());
  }

  groupSize(bodySize?: Size): Size {
    bodySize = this.size(bodySize);
    bodySize.scale(this.groupScale());
    return bodySize;
  }

  neighborAt(inDirection: Direction): TypedNeighborData {
    return super.neighborAt(inDirection) as TypedNeighborData;
  }

  ensureNeighbor(inDirection: Direction): TypedNeighborData {
    return super.ensureNeighbor(inDirection) as TypedNeighborData;
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
      // console.log("Given coords are outside this node's body.
      //   (Horizontal minimum exceeds X-coord)");
      return false;
    }
    if (x > userScale * ax + (userScale * aScale * s.width()) / 2) {
      // console.log("Given coords are outside this node's body.
      //   (X-coord exceeds horizontal maximum)");
      return false;
    }
    if (y < userScale * ay - (userScale * aScale * s.height()) / 2) {
      // console.log("Given coords are outside this node's body.
      //   (Vertical minimum exceeds Y-coord)");
      return false;
    }
    if (y > userScale * ay + (userScale * aScale * s.height()) / 2) {
      // console.log("Given coords are outside this node's body.
      //   (Y-coord exceeds vertical maximum)");
      return false;
    }
    // console.log("Within node body" + this);
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

  nodeUnderCoords(x: number, y: number, userScale?: number): this {
    // console.log("nodeUnderCoords: " + x + ", " + y)
    if (userScale === undefined) {
      userScale = 1;
    }

    const extentSize: Size = new Size();
    const candidates: this[] = [this];

    const addCandidate = (node: this, direction: Direction) => {
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

    const FORCE_SELECT_PRIOR: this = null;
    while (candidates.length > 0) {
      const candidate = candidates[candidates.length - 1];
      // console.log("Checking node " +
      //   candidate._id + " = " + candidate.label());

      if (candidate === FORCE_SELECT_PRIOR) {
        candidates.pop();
        return candidates.pop();
      }

      if (candidate.inNodeBody(x, y, userScale, extentSize)) {
        // console.log("Click is in node body");
        if (candidate.hasNode(Direction.INWARD)) {
          if (
            candidate
              .nodeAt(Direction.INWARD)
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
      if (!candidate.inNodeExtents(x, y, userScale, extentSize)) {
        // Nope, so continue the search.
        // console.log("Click is not in node extents.");
        continue;
      }
      // console.log("Click is in node extent");

      // It is potentially within some child, so search the children.
      if (
        Math.abs(y - userScale * candidate.absoluteY()) >
        Math.abs(x - userScale * candidate.absoluteX())
      ) {
        // Y extent is greater than X extent.
        if (userScale * candidate.absoluteX() > x) {
          addCandidate(candidate, Direction.BACKWARD);
          addCandidate(candidate, Direction.FORWARD);
        } else {
          addCandidate(candidate, Direction.FORWARD);
          addCandidate(candidate, Direction.BACKWARD);
        }
        if (userScale * candidate.absoluteY() > y) {
          addCandidate(candidate, Direction.UPWARD);
          addCandidate(candidate, Direction.DOWNWARD);
        } else {
          addCandidate(candidate, Direction.DOWNWARD);
          addCandidate(candidate, Direction.UPWARD);
        }
      } else {
        // X extent is greater than Y extent.
        if (userScale * candidate.absoluteY() > y) {
          addCandidate(candidate, Direction.UPWARD);
          addCandidate(candidate, Direction.DOWNWARD);
        } else {
          addCandidate(candidate, Direction.DOWNWARD);
          addCandidate(candidate, Direction.UPWARD);
        }
        if (userScale * candidate.absoluteX() > x) {
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

  separationAt(inDirection: Direction): number {
    // Exclude some directions that cannot be calculated.
    if (!isCardinalDirection(inDirection)) {
      throw createException(BAD_NODE_DIRECTION);
    }

    // If the given direction is the parent's direction, use
    // their measurement instead.
    if (!this.isRoot() && inDirection == this.parentDirection()) {
      return this.nodeParent().separationAt(reverseDirection(inDirection));
    }

    if (!this.hasNode(inDirection)) {
      throw createException(NO_NODE_FOUND);
    }

    return this.neighborAt(inDirection).separation;
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
