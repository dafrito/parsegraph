import Extent from 'parsegraph-extent';
import {
  Direction,
  Axis,
  getPerpendicularAxis,
  getPositiveDirection,
  getNegativeDirection,
  directionSign,
  getDirectionAxis,
  isCardinalDirection,
  reverseDirection,
  isVerticalDirection,
  forEachCardinalDirection,
  PreferredAxis,
  LayoutState
} from 'parsegraph-direction';
import LayoutNode, {
} from './LayoutNode';
import Fit from './Fit';
import Alignment from './Alignment';
import AxisOverlap from './AxisOverlap';
import createException, {
  BAD_NODE_DIRECTION,
  BAD_NODE_ALIGNMENT,
} from './Exception';
import Size from 'parsegraph-size';
import BaseCommitLayoutData from './BaseCommitLayoutData';

/**
 * The thickness (diameter) of the line.
 */
export const LINE_THICKNESS = 12;

export default class CommitLayoutData extends BaseCommitLayoutData {
  lineBounds: Size;
  bv: [number, number, number];
  firstSize: Size;
  secondSize: Size;

  constructor(node: LayoutNode, timeout?: number) {
    super(node, timeout);
    this.lineBounds = new Size();
    this.bv = [null, null, null];
    this.firstSize = new Size();
    this.secondSize = new Size();
  }

  findConsecutiveLength(node: LayoutNode, inDirection: Direction) {
    // Exclude some directions that cannot be calculated.
    if (!isCardinalDirection(inDirection)) {
      throw createException(BAD_NODE_DIRECTION);
    }

    const directionAxis: Axis = getDirectionAxis(inDirection);
    if (directionAxis === Axis.NULL) {
      // This should be impossible.
      throw createException(BAD_NODE_DIRECTION);
    }

    // Calculate the length, starting from the center of this node.
    let total: number = 0;
    let scale: number = 1.0;

    // Iterate in the given direction.
    if (node.hasNode(inDirection)) {
      total += node.separationAt(inDirection);

      scale *= node.scaleAt(inDirection);
      let thisNode: LayoutNode = node.nodeAt(inDirection);
      let nextNode: LayoutNode = thisNode.nodeAt(inDirection);
      while (nextNode !== null) {
        total += thisNode.separationAt(inDirection) * scale;
        scale *= thisNode.scaleAt(inDirection);

        thisNode = nextNode;
        nextNode = nextNode.nodeAt(inDirection);
      }
    }

    return total;
  }

  /**
   * Returns the offset of the child's center in the given direction from
   * this node's center.
   *
   * This offset is in a direction perpendicular to the given direction
   * and is positive to indicate a negative offset.
   *
   * The result is in this node's space.
   * 
   * @param {LayoutNode} node the node to retrieve alignment offset
   * @param {Direction} childDirection the direction where alignment offset is retrieved
   * @return {number} the alignment offset
   */
  getAlignment(node: LayoutNode, childDirection: Direction): number {
    // Calculate the alignment adjustment for both nodes.
    const child = node.nodeAt(childDirection);
    const axis = getPerpendicularAxis(getDirectionAxis(childDirection));

    let rv;

    const alignmentMode = node.nodeAlignmentMode(childDirection);
    switch (alignmentMode) {
      case Alignment.NULL:
        throw createException(BAD_NODE_ALIGNMENT);
      case Alignment.NONE:
        // Unaligned nodes have no alignment offset.
        rv = 0;
        break;
      case Alignment.NEGATIVE:
        rv = this.findConsecutiveLength(child, getNegativeDirection(axis));
        break;
      case Alignment.CENTER: {
        const negativeLength: number = this.findConsecutiveLength(
            child,
            getNegativeDirection(axis),
        );

        const positiveLength: number = this.findConsecutiveLength(
            child,
            getPositiveDirection(axis),
        );

        const halfLength: number = (negativeLength + positiveLength) / 2;

        if (negativeLength > positiveLength) {
          // The child's negative neighbors extend
          // more than their positive neighbors.
          rv = negativeLength - halfLength;
        } else if (negativeLength < positiveLength) {
          rv = -(positiveLength - halfLength);
        } else {
          rv = 0;
        }
        break;
      }
      case Alignment.POSITIVE:
        rv = -this.findConsecutiveLength(child, getPositiveDirection(axis));
        break;
    }
    // console.log("Found alignment of " + rv);
    return rv * node.scaleAt(childDirection);
  }

  /**
   * Positions a child.
   *
   * The alignment is positive in the positive direction.
   *
   * The separation is positive in the direction of the child.
   *
   * These values should in this node's space.
   *
   * The child's position is in this node's space.
   * 
   * @param {LayoutNode} node the node to position
   * @param {Direction} childDirection the direction to position
   * @param {Alignment} alignment the alignment used for the given direction
   * @param {number} separation the separation used for the given child
   */
  positionChild(
      node: LayoutNode,
      childDirection: Direction,
      alignment: Alignment,
      separation: number,
  ): void {
    // Validate arguments.
    if (separation < 0) {
      throw new Error('separation must always be positive.');
    }
    if (!isCardinalDirection(childDirection)) {
      throw createException(BAD_NODE_DIRECTION);
    }
    const child: LayoutNode = node.nodeAt(childDirection);
    const reversedDirection: Direction = reverseDirection(childDirection);

    // Save alignment parameters.
    node.neighborAt(childDirection).alignmentOffset = alignment;
    // console.log("Alignment = " + alignment);
    node.neighborAt(childDirection).separation = separation;

    // Determine the line length.
    let extentSize: number;
    if (node.nodeAlignmentMode(childDirection) === Alignment.NONE) {
      child.size(this.firstSize);
      if (isVerticalDirection(childDirection)) {
        extentSize = this.firstSize.height() / 2;
      } else {
        extentSize = this.firstSize.width() / 2;
      }
    } else {
      extentSize = child
          .extentsAt(reversedDirection)
          .sizeAt(
              node.neighborAt(childDirection).getNode().extentOffsetAt(
                  reversedDirection,
              ) -
            alignment / node.scaleAt(childDirection),
          );
    }
    const lineLength = separation - node.scaleAt(childDirection) * extentSize;
    node.neighborAt(childDirection).lineLength = lineLength;
    // console.log(
    //   "Line length: " + lineLength + ",
    //   separation: " + separation + ",
    //   extentSize: " + extentSize);

    // Set the position.
    const dirSign = directionSign(childDirection);
    if (isVerticalDirection(childDirection)) {
      // The child is positioned vertically.
      node.setPosAt(childDirection, alignment, dirSign * separation);
    } else {
      node.setPosAt(childDirection, dirSign * separation, alignment);
    }
    /* console.log(
              nameDirection(childDirection) + " " +
              nameType(child.type()) + "'s position set to (" +
              this.neighborAt(childDirection).xPos + ", " +
              this.neighborAt(childDirection).yPos + ")"
          );*/
  };

  initExtent(
      node: LayoutNode,
      inDirection: Direction,
      length: number,
      size: number,
      offset: number,
  ) {
    const extent = node.extentsAt(inDirection);
    extent.clear();
    extent.appendLS(length, size);
    node.setExtentOffsetAt(inDirection, offset);
    // console.log(new Error("OFFSET = " + offset));
  };

  commitLayout(node: LayoutNode): boolean {
    const laidOut = super.commitLayout(node);

    if(node._layoutState === LayoutState.COMMITTED) {
      return laidOut;
    }

    if (node._nodeFit === Fit.NAIVE && (node.isRoot() || node.x() !== null)) {
      node._layoutState = LayoutState.COMMITTED;
      return;
    }

    if (node.isRootlike()) {
      if(this.commitRootlikeLayout(node)) {
        node._layoutState = LayoutState.NEEDS_COMMIT;
        return true;
      }
    } else {
      if(this.commitAxisBasedLayout(node)) {
        node._layoutState = LayoutState.NEEDS_COMMIT;
        return true;
      }
    }

    // Set our extents, combined with non-point neighbors.
    forEachCardinalDirection((dir:Direction)=>{
      this.addLineBounds(node, dir);
    });

    if(this.commitInwardLayout(node) === true) {
      return true;
    }

    node._layoutState = LayoutState.COMMITTED;

    // Needed a commit, so return true.
    return true;
  }

  commitAxisBasedLayout(node: LayoutNode): boolean {
    // Layout based upon the axis preference.
    if (node.canonicalLayoutPreference() == PreferredAxis.PERPENDICULAR) {
      const firstAxis: Axis = getPerpendicularAxis(node.parentDirection());

      // Check for nodes perpendicular to parent's direction
      const hasFirstAxisNodes: [Direction, Direction] = node.hasNodes(firstAxis);
      const oppositeFromParent: Direction = reverseDirection(
          node.parentDirection(),
      );
      if (
        this.layoutAxis(node,
            hasFirstAxisNodes[0],
            hasFirstAxisNodes[1],
            false,
        )
      ) {
        return true;
      }

      // Layout this node's second-axis child, if that child exists.
      if (node.hasNode(oppositeFromParent)) {
        // Layout the second-axis child.
        if (this.layoutSingle(node, oppositeFromParent, true)) {
          return true;
        }
      }
    } else {
      // Layout this node's second-axis child, if that child exists.
      const oppositeFromParent: Direction = reverseDirection(
          node.parentDirection(),
      );

      // Check for nodes perpendicular to parent's direction
      const perpendicularNodes: [Direction, Direction] = node.hasNodes(
          getPerpendicularAxis(node.parentDirection()),
      );

      if (node.hasNode(oppositeFromParent)) {
        // Layout the second-axis child.
        if (
          this.layoutSingle(
              node,
              oppositeFromParent,
              // perpendicularNodes[0] !== Direction.NULL ||
              //   perpendicularNodes[1] !== Direction.NULL
              true
          )
        ) {
          return true;
        }
      }

      if (
        this.layoutAxis(
            node,
            perpendicularNodes[0],
            perpendicularNodes[1],
            true,
        )
      ) {
        return true;
      }
    }
  }

  commitRootlikeLayout(node: LayoutNode): boolean {
    if (
      node._layoutPreference === PreferredAxis.HORIZONTAL ||
      node._layoutPreference == PreferredAxis.PERPENDICULAR
    ) {
      // Root-like, so just lay out both axes.
      if (
        this.layoutAxis(node, 
            Direction.BACKWARD,
            Direction.FORWARD,
            !node.hasNode(Direction.UPWARD) &&
                    !node.hasNode(Direction.DOWNWARD),
        )
      ) {
        return true;
      }

      // This node is root-like, so it lays out the second-axis children in
      // the same method as the first axis.
      if (this.layoutAxis(node, Direction.UPWARD, Direction.DOWNWARD, true)) {
        return true;
      }
    } else {
      // Root-like, so just lay out both axes.
      if (
        this.layoutAxis(node, 
            Direction.UPWARD,
            Direction.DOWNWARD,
            !node.hasNode(Direction.BACKWARD) &&
            !node.hasNode(Direction.FORWARD),
        )
      ) {
        return true;
      }

      // This node is root-like, so it lays out the second-axis children in
      // the same method as the first axis.
      if (
        this.layoutAxis(node, Direction.BACKWARD, Direction.FORWARD, true)
      ) {
        return true;
      }
    }
  }

  commitInwardLayout(node: LayoutNode): boolean {
    if (!node.hasNode(Direction.INWARD)) {
      return false;
    }
    const nestedNode: LayoutNode = node.nodeAt(Direction.INWARD);
    if (nestedNode._layoutState !== LayoutState.COMMITTED) {
      node._layoutState = LayoutState.NEEDS_COMMIT;
      return true;
    }
    const nestedSize: Size = nestedNode.extentSize(this.firstSize);
    if (
      node.nodeAlignmentMode(Direction.INWARD) === Alignment.INWARD_VERTICAL
    ) {
      node.setPosAt(
          Direction.INWARD,
          nestedNode.scale() *
          (nestedNode.extentOffsetAt(Direction.DOWNWARD) -
            nestedSize.width() / 2),
          this.bodySize.height() / 2 -
          node.verticalPadding() -
          node.borderThickness() +
          nestedNode.scale() *
            (-nestedSize.height() +
              nestedNode.extentOffsetAt(Direction.FORWARD)),
      );
    } else {
      // console.log(this.horizontalPadding(), this.borderThickness());
      node.setPosAt(
          Direction.INWARD,
          this.bodySize.width() / 2 -
          node.horizontalPadding() -
          node.borderThickness() +
          nestedNode.scale() *
            (-nestedSize.width() +
              nestedNode.extentOffsetAt(Direction.DOWNWARD)),
          nestedNode.scale() *
          (nestedNode.extentOffsetAt(Direction.FORWARD) -
            nestedSize.height() / 2),
      );
    }
  }

  combineExtent(
      node: LayoutNode,
      childDirection: Direction,
      direction: Direction,
      lengthAdjustment: number,
      sizeAdjustment: number,
  ): void {
    /* console.log(
                "combineExtent(" +
                nameDirection(direction) + ", " +
                lengthAdjustment + ", " +
                sizeAdjustment + ")"
            );*/
    // Calculate the new offset to this node's center.
    const child = node.nodeAt(childDirection);
    const lengthOffset =
      node.extentOffsetAt(direction) +
      lengthAdjustment -
      node.scaleAt(childDirection) * child.extentOffsetAt(direction);

    // Combine the two extents in the given direction.
    /* console.log("Combining " + nameDirection(direction) + ", " );
            console.log("Child: " + nameLayoutState(child._layoutState));
            console.log("Length offset: " + lengthOffset);
            console.log("Size adjustment: " + sizeAdjustment);
            console.log("ExtentOffset : " +
              node.neighborAt(direction).extentOffset);
            console.log("Scaled child ExtentOffset : " +
            (node.scaleAt(childDirection) * child.extentOffsetAt(direction))); */
    const e: Extent = node.extentsAt(direction);
    const scale: number = node.scaleAt(childDirection);
    if (node.nodeFit() == Fit.LOOSE) {
      e.combineExtentAndSimplify(
          child.extentsAt(direction),
          lengthOffset,
          sizeAdjustment,
          scale,
          this.bv,
      );
    } else {
      e.combineExtent(
          child.extentsAt(direction),
          lengthOffset,
          sizeAdjustment,
          scale,
      );
    }

    // Adjust the length offset to remain positive.
    if (lengthOffset < 0) {
      // console.log("Adjusting negative extent offset.");
      node.setExtentOffsetAt(
          direction,
          node.extentOffsetAt(direction) + Math.abs(lengthOffset),
      );
    }

    /* console.log(
                "New "
                + nameDirection(direction)
                + " extent offset = "
                + this.extentOffsetAt(direction)
            );
            this.extentsAt(direction).forEach(function(l, s, i) {
                console.log(i + ". length=" + l + ", size=" + s);
            });*/

    // Assert the extent offset is positive.
    if (node.extentOffsetAt(direction) < 0) {
      throw new Error('Extent offset must not be negative.');
    }
  };

  /**
   * Merge this node's extents in the given direction with the
   * child's extents.
   *
   * alignment is the offset of the child from this node.
   * Positive values indicate presence in the positive
   * direction. (i.e. forward or upward).
   *
   * separation is the distance from the center of this node to the center
   * of the node in the specified direction.
   * 
   * @param {LayoutNode} node the node to work with
   * @param {Direction} childDirection the direction used for combining extents
   * @param {Alignment} alignment the alignment in the given direction
   * @param {number} separation the separation between nodes
   */
  combineExtents(
      node: LayoutNode,
      childDirection: Direction,
      alignment: Alignment,
      separation: number,
  ): void {
    // Combine an extent.
    // lengthAdjustment and sizeAdjustment are in this node's space.

    switch (childDirection) {
      case Direction.DOWNWARD:
        // Downward child.
        this.combineExtent(node, childDirection, Direction.DOWNWARD, alignment, separation);
        this.combineExtent(node, childDirection, Direction.UPWARD, alignment, -separation);

        this.combineExtent(node, childDirection, Direction.FORWARD, separation, alignment);
        this.combineExtent(node, childDirection, Direction.BACKWARD, separation, -alignment);
        break;
      case Direction.UPWARD:
        // Upward child.
        this.combineExtent(node, childDirection, Direction.DOWNWARD, alignment, -separation);
        this.combineExtent(node, childDirection, Direction.UPWARD, alignment, separation);

        this.combineExtent(node, childDirection, Direction.FORWARD, -separation, alignment);
        this.combineExtent(node, childDirection, Direction.BACKWARD, -separation, -alignment);
        break;
      case Direction.FORWARD:
        // Forward child.
        this.combineExtent(node, childDirection, Direction.DOWNWARD, separation, alignment);
        this.combineExtent(node, childDirection, Direction.UPWARD, separation, -alignment);

        this.combineExtent(node, childDirection, Direction.FORWARD, alignment, separation);
        this.combineExtent(node, childDirection, Direction.BACKWARD, alignment, -separation);
        break;
      case Direction.BACKWARD:
        // Backward child.
        this.combineExtent(node, childDirection, Direction.DOWNWARD, -separation, alignment);
        this.combineExtent(node, childDirection, Direction.UPWARD, -separation, -alignment);

        this.combineExtent(node, childDirection, Direction.FORWARD, alignment, -separation);
        this.combineExtent(node, childDirection, Direction.BACKWARD, alignment, separation);
        break;
      default:
        throw createException(BAD_NODE_DIRECTION);
    }
  }

  // Layout a single node in the given direction.
  layoutSingle(
      node: LayoutNode,
      direction: Direction,
      allowAxisOverlap: boolean
  ): boolean {
    if (!node.hasNode(direction)) {
      return;
    }

    switch (node.axisOverlap(direction)) {
      case AxisOverlap.PREVENTED:
        allowAxisOverlap = false;
        break;
      case AxisOverlap.ALLOWED:
        allowAxisOverlap = true;
        break;
    }

    /* console.log(
              "Laying out single " + nameDirection(direction) + " child, "
              + (allowAxisOverlap ? "with " : "without ") + "axis overlap."
          );*/

    // Get the alignment for the children.
    const alignment: number = this.getAlignment(node, direction);
    // console.log("Calculated alignment of " + alignment + ".");

    const child: LayoutNode = node.nodeAt(direction);
    const reversed: Direction = reverseDirection(direction);
    const childExtent: Extent = child.extentsAt(reversed);

    if (child._layoutState !== LayoutState.COMMITTED) {
      node._layoutState = LayoutState.NEEDS_COMMIT;
      // console.log(Node.getLayoutNodes(child.findPaintGroup()));
      // console.log(namePreferredAxis(child._layoutPreference));
      // console.log("Child's paint group is dirty: " +
      //   child.findPaintGroup().isDirty());
      // console.log(nameDirection(direction) + " Child " +
      //   nameType(child.type()) + " " + (child._id) +
      //   " does not have a committed layout.
      //   Child's layout state is " +
      //   nameLayoutState(child._layoutState), child);
      return true;
    }

    // Separate the child from this node.

    let separationFromChild: number = node.extentsAt(direction).separation(
        childExtent,
        node.extentOffsetAt(direction) +
        alignment -
        node.scaleAt(direction) * child.extentOffsetAt(reversed),
        allowAxisOverlap,
        node.scaleAt(direction),
        LINE_THICKNESS / 2,
    );
    // console.log("Calculated unpadded separation of " +
    //   separationFromChild + ".");

    // Add padding and ensure the child is not separated less than
    // it would be if the node was not offset by alignment.
    child.size(this.firstSize);
    if (getDirectionAxis(direction) == Axis.VERTICAL) {
      separationFromChild = Math.max(
          separationFromChild,
          node.scaleAt(direction) * (this.firstSize.height() / 2) +
          this.bodySize.height() / 2,
      );
      separationFromChild +=
        node.verticalSeparation(direction) * node.scaleAt(direction);
    } else {
      separationFromChild = Math.max(
          separationFromChild,
          node.scaleAt(direction) * (this.firstSize.width() / 2) +
          this.bodySize.width() / 2,
      );
      separationFromChild +=
        node.horizontalSeparation(direction) * node.scaleAt(direction);
    }
    // console.log("Calculated padded separation of " +
    //   separationFromChild + ".");

    // Set the node's position.
    this.positionChild(node, direction, alignment, separationFromChild);

    // Combine the extents of the child and this node.
    this.combineExtents(node, direction, alignment, separationFromChild);
  };

  // Layout a pair of nodes in the given directions.
  layoutAxis(node: LayoutNode, 
      firstDirection: Direction,
      secondDirection: Direction,
      allowAxisOverlap: boolean,
  ): boolean {
    if (
      firstDirection === secondDirection &&
      firstDirection != Direction.NULL
    ) {
      throw createException(BAD_NODE_DIRECTION);
    }
    // Change the node direction to null if there is no node in that
    // direction.
    if (!node.hasNode(firstDirection)) {
      firstDirection = Direction.NULL;
    }
    if (!node.hasNode(secondDirection)) {
      secondDirection = Direction.NULL;
    }

    // Return if there are no directions.
    if (
      firstDirection == Direction.NULL &&
      secondDirection == Direction.NULL
    ) {
      return;
    }

    // Test if this node has a first-axis child in only one direction.
    if (
      firstDirection == Direction.NULL ||
      secondDirection == Direction.NULL
    ) {
      // Find the direction of the only first-axis child.
      let firstAxisDirection: Direction;
      if (firstDirection != Direction.NULL) {
        firstAxisDirection = firstDirection;
      } else {
        // It must be the second direction.
        firstAxisDirection = secondDirection;
      }

      // Layout that node.
      if (this.layoutSingle(node, firstAxisDirection, allowAxisOverlap)) {
        node._layoutState = LayoutState.NEEDS_COMMIT;
        return true;
      }
      return;
    }

    /* console.log(
              "Laying out " +
              nameDirection(firstDirection) + " and " +
              nameDirection(secondDirection) + " children."
          );*/

    // This node has first-axis children in both directions.
    const firstNode: LayoutNode = node.nodeAt(firstDirection);
    const secondNode: LayoutNode = node.nodeAt(secondDirection);

    // Get the alignments for the children.
    const firstNodeAlignment: number = this.getAlignment(node, firstDirection);
    const secondNodeAlignment: number = this.getAlignment(node, secondDirection);
    // console.log("First alignment: " + firstNodeAlignment);
    // console.log("Second alignment: " + secondNodeAlignment);

    let separationBetweenChildren: number = firstNode
        .extentsAt(secondDirection)
        .separation(
            secondNode.extentsAt(firstDirection),
            (node.scaleAt(secondDirection) / node.scaleAt(firstDirection)) *
          (secondNodeAlignment - secondNode.extentOffsetAt(firstDirection)) -
          (firstNodeAlignment - firstNode.extentOffsetAt(secondDirection)),
            true,
            node.scaleAt(secondDirection) / node.scaleAt(firstDirection),
            0,
        );
    separationBetweenChildren *= node.scaleAt(firstDirection);

    // console.log("Separation between children="
    //   + separationBetweenChildren);

    /*
          var firstExtent = this.extentsAt(firstDirection);
          console.log(
              "This " +
              nameDirection(firstDirection) +
              " extent (offset to center=" +
              this.extentOffsetAt(firstDirection) +
              ")"
          );
          firstExtent.forEach(
              function(length, size, i) {
                  console.log(i + ". l=" + length + ", s=" + size);
              }
          );

          console.log(
              nameDirection(firstDirection) +
              " " + nameType(this.nodeAt(firstDirection).type()) +
              "'s " + nameDirection(secondDirection) +
              " extent (offset to center=" +
              this.nodeAt(firstDirection).extentOffsetAt(secondDirection) +
              ")"
          );
          this.nodeAt(firstDirection).extentsAt(secondDirection).forEach(
              function(length, size, i) {
                  console.log(i + ". l=" + length + ", s=" + size);
              }
          );

          console.log(
              "FirstNodeAlignment=" + firstNodeAlignment
          );
          console.log(
              "firstDirection extentOffset=" +
                  this.extentOffsetAt(firstDirection)
          );
          console.log(
              "firstNode.extentOffsetAt(secondDirection)=" +
              firstNode.extentOffsetAt(secondDirection)
          );*/

    let firstAxisOverlap: boolean = allowAxisOverlap;
    switch (node.nodeAt(firstDirection).axisOverlap()) {
      case AxisOverlap.PREVENTED:
        firstAxisOverlap = false;
        break;
      case AxisOverlap.ALLOWED:
        firstAxisOverlap = true;
        break;
    }
    let secondAxisOverlap: boolean = allowAxisOverlap;
    switch (node.nodeAt(secondDirection).axisOverlap()) {
      case AxisOverlap.PREVENTED:
        secondAxisOverlap = false;
        break;
      case AxisOverlap.ALLOWED:
        secondAxisOverlap = true;
        break;
    }

    // Allow some overlap if we have both first-axis sides, but
    // nothing ahead on the second axis.
    let separationFromFirst: number = node.extentsAt(
        firstDirection,
    ).separation(
        firstNode.extentsAt(secondDirection),
        node.extentOffsetAt(firstDirection) +
        firstNodeAlignment -
        node.scaleAt(firstDirection) *
          firstNode.extentOffsetAt(secondDirection),
        firstAxisOverlap,
        node.scaleAt(firstDirection),
        LINE_THICKNESS / 2,
    );

    let separationFromSecond: number = node.extentsAt(
        secondDirection,
    ).separation(
        secondNode.extentsAt(firstDirection),
        node.extentOffsetAt(secondDirection) +
        secondNodeAlignment -
        node.scaleAt(secondDirection) *
          secondNode.extentOffsetAt(firstDirection),
        secondAxisOverlap,
        node.scaleAt(secondDirection),
        LINE_THICKNESS / 2,
    );

    /* console.log(
              "Separation from this " + nameType(this.type()) + " to " +
              nameDirection(firstDirection) + " " +
              nameType(this.nodeAt(firstDirection).type()) + "=" +
              separationFromFirst
          );
          console.log(
              "Separation from this " + nameType(this.type()) + " to " +
              nameDirection(secondDirection) + " " +
              nameType(this.nodeAt(secondDirection).type()) + "=" +
              separationFromSecond
          );*/

    // TODO Handle occlusion of the second axis if we have a parent or
    // if we have a second-axis child. Doesn't this code need to ensure
    // the second-axis child is not trapped inside too small a space?

    if (
      separationBetweenChildren >=
      separationFromFirst + separationFromSecond
    ) {
      // The separation between the children is greater than the
      // separation between each child and this node.

      // Center them as much as possible.
      separationFromFirst = Math.max(
          separationFromFirst,
          separationBetweenChildren / 2,
      );
      separationFromSecond = Math.max(
          separationFromSecond,
          separationBetweenChildren / 2,
      );
    } else {
      // separationBetweenChildren
      //    < separationFromFirst + separationFromSecond
      // The separation between children is less than what this node
      // needs to separate each child from itself, so do nothing to
      // the separation values.
    }

    firstNode.size(this.firstSize);
    secondNode.size(this.secondSize);
    if (getDirectionAxis(firstDirection) === Axis.VERTICAL) {
      separationFromFirst = Math.max(
          separationFromFirst,
          node.scaleAt(firstDirection) * (this.firstSize.height() / 2) +
          this.bodySize.height() / 2,
      );
      separationFromFirst +=
        node.verticalSeparation(firstDirection) *
        node.scaleAt(firstDirection);

      separationFromSecond = Math.max(
          separationFromSecond,
          node.scaleAt(secondDirection) * (this.secondSize.height() / 2) +
          this.bodySize.height() / 2,
      );
      separationFromSecond +=
        node.verticalSeparation(secondDirection) *
        node.scaleAt(secondDirection);
    } else {
      separationFromFirst = Math.max(
          separationFromFirst,
          node.scaleAt(firstDirection) * (this.firstSize.width() / 2) +
          this.bodySize.width() / 2,
      );
      separationFromFirst +=
        node.horizontalSeparation(firstDirection) *
        node.scaleAt(firstDirection);

      separationFromSecond = Math.max(
          separationFromSecond,
          node.scaleAt(secondDirection) * (this.secondSize.width() / 2) +
          this.bodySize.width() / 2,
      );
      separationFromSecond +=
        node.horizontalSeparation(secondDirection) *
        node.scaleAt(secondDirection);
    }

    // Set the positions of the nodes.
    this.positionChild(node,
        firstDirection,
        firstNodeAlignment,
        separationFromFirst,
    );
    this.positionChild(node,
        secondDirection,
        secondNodeAlignment,
        separationFromSecond,
    );

    // Combine their extents.
    this.combineExtents(node,
        firstDirection,
        firstNodeAlignment,
        separationFromFirst,
    );
    this.combineExtents(node,
        secondDirection,
        secondNodeAlignment,
        separationFromSecond,
    );
  }

  addLineBounds(node: LayoutNode, given: Direction) {
    if (!node.hasChild(given)) {
      return;
    }

    const perpAxis: Axis = getPerpendicularAxis(given);
    const dirSign: number = directionSign(given);

    let positiveOffset: number = node.extentOffsetAt(
        getPositiveDirection(perpAxis),
    );
    let negativeOffset: number = node.extentOffsetAt(
        getNegativeDirection(perpAxis),
    );

    if (dirSign < 0) {
      const lineSize: number = node.sizeIn(given, this.lineBounds);
      positiveOffset -= lineSize + node.lineLengthAt(given);
      negativeOffset -= lineSize + node.lineLengthAt(given);
    }

    if (node.nodeFit() == Fit.EXACT) {
      // Append the line-shaped bound.
      let lineSize: number;
      if (perpAxis === Axis.VERTICAL) {
        lineSize = this.bodySize.height() / 2;
      } else {
        lineSize = this.bodySize.width() / 2;
      }
      // lineSize = this.scaleAt(given) * LINE_THICKNESS / 2;
      node.extentsAt(getPositiveDirection(perpAxis)).combineBound(
          positiveOffset,
          node.lineLengthAt(given),
          lineSize,
      );
      node.extentsAt(getNegativeDirection(perpAxis)).combineBound(
          negativeOffset,
          node.lineLengthAt(given),
          lineSize,
      );
    }
  }
}
