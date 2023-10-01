import { Extent } from "../Extent";

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
} from "../../../Direction";

import {
  Alignment,
  DirectionNode,
  Fit,
  PreferredAxis,
  AxisOverlap,
} from "../..";

import createException, {
  BAD_NODE_DIRECTION,
  BAD_NODE_ALIGNMENT,
} from "../../../Exception";

import { LayoutPhase } from "..";

import { Size } from "../../../Size";

import { BaseCommitLayout } from "./BaseCommitLayout";
import { LayoutPainter } from "./LayoutPainter";

/**
 * The thickness (diameter) of the line.
 */
export const LINE_THICKNESS = 12;

/**
 * Computes the {@link Layout} for {@link DirectionNode} graphs.
 *
 * @see {@link LayoutPainter}
 */
export class CommitLayout extends BaseCommitLayout {
  private lineBounds: Size;
  private bv: [number, number, number];

  /**
   * Creates a new run of the layout algorithm.
   *
   * @param {DirectionNode} node - the root node
   * @param {LayoutPainter} painter - the painter used for sizing and painting information.
   */
  constructor(node: DirectionNode, painter: LayoutPainter) {
    super(node, painter);
    this.lineBounds = new Size();
    this.bv = [NaN, NaN, NaN];
  }

  private findConsecutiveLength(node: DirectionNode, inDirection: Direction) {
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
    if (node.neighbors().hasNode(inDirection)) {
      total += node.neighbors().separationAt(inDirection);

      scale *= node.neighbors().nodeAt(inDirection).scale();
      let thisNode: DirectionNode = node.neighbors().nodeAt(inDirection);
      let nextNode: DirectionNode = thisNode.neighbors().nodeAt(inDirection);
      while (nextNode) {
        total += thisNode.neighbors().separationAt(inDirection) * scale;
        scale *= thisNode.neighbors().nodeAt(inDirection).scale();

        thisNode = nextNode;
        nextNode = nextNode.neighbors().nodeAt(inDirection);
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
   * @param {DirectionNode} node the node to retrieve alignment offset
   * @param {Direction} childDirection the direction where alignment offset is retrieved
   * @return {number} the alignment offset
   */
  private getAlignment(node: DirectionNode, childDirection: Direction): number {
    // Calculate the alignment adjustment for both nodes.
    const child = node.neighbors().nodeAt(childDirection);
    const axis = getPerpendicularAxis(getDirectionAxis(childDirection));

    let rv;

    const alignmentMode = node.getAlignment(childDirection);
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
          getNegativeDirection(axis)
        );

        const positiveLength: number = this.findConsecutiveLength(
          child,
          getPositiveDirection(axis)
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
    return rv * node.neighbors().nodeAt(childDirection).scale();
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
   * @param {DirectionNode} node the node to position
   * @param {Direction} childDirection the direction to position
   * @param {Alignment} alignment the alignment used for the given direction
   * @param {number} separation the separation used for the given child
   */
  private positionChild(
    node: DirectionNode,
    childDirection: Direction,
    alignment: Alignment,
    separation: number
  ): void {
    // Validate arguments.
    if (separation < 0) {
      throw new Error("separation must always be positive.");
    }
    if (!isCardinalDirection(childDirection)) {
      throw createException(BAD_NODE_DIRECTION);
    }
    const child: DirectionNode = node.neighbors().nodeAt(childDirection);
    const reversedDirection: Direction = reverseDirection(childDirection);

    // Save alignment parameters.
    node.neighbors().at(childDirection).alignmentOffset = alignment;
    // console.log("Alignment = " + alignment);
    node.neighbors().at(childDirection).separation = separation;

    // Determine the line length.
    let extentSize: number;
    if (node.getAlignment(childDirection) === Alignment.NONE) {
      child.layout().size(this.firstSize);
      if (isVerticalDirection(childDirection)) {
        extentSize = this.firstSize.height() / 2;
      } else {
        extentSize = this.firstSize.width() / 2;
      }
    } else {
      extentSize = child
        .layout()
        .extentsAt(reversedDirection)
        .sizeAt(
          child.layout().extentOffsetAt(reversedDirection) -
            alignment / node.neighbors().nodeAt(childDirection).scale()
        );
    }
    const lineLength =
      separation - node.neighbors().nodeAt(childDirection).scale() * extentSize;
    node.neighbors().at(childDirection).lineLength = lineLength;
    // console.log(
    //   "Line length: " + lineLength + ",
    //   separation: " + separation + ",
    //   extentSize: " + extentSize);

    // Set the position.
    const dirSign = directionSign(childDirection);
    if (isVerticalDirection(childDirection)) {
      // The child is positioned vertically.
      node
        .neighbors()
        .setPosAt(childDirection, alignment, dirSign * separation);
    } else {
      node
        .neighbors()
        .setPosAt(childDirection, dirSign * separation, alignment);
    }
    /* console.log(
              nameDirection(childDirection) + " " +
              nameType(child.type()) + "'s position set to (" +
              this.neighbors().at(childDirection).xPos + ", " +
              this.neighbors().at(childDirection).yPos + ")"
          );*/
  }

  protected override initExtent(
    node: DirectionNode,
    inDirection: Direction,
    length: number,
    size: number,
    offset: number
  ) {
    const extent = node.layout().extentsAt(inDirection);
    extent.clear();
    extent.appendLS(length, size);
    node.layout().setExtentOffsetAt(inDirection, offset);
    // console.log(new Error("OFFSET = " + offset));
  }

  protected override commitLayout(node: DirectionNode): boolean {
    const laidOut = super.commitLayout(node);

    if (node.layout().phase() === LayoutPhase.COMMITTED) {
      return laidOut;
    }

    if (
      node.nodeFit() === Fit.NAIVE &&
      (node.neighbors().isRoot() || !isNaN(node.parentX()))
    ) {
      node.layout().setPhase(LayoutPhase.COMMITTED);
      return false;
    }

    if (node.neighbors().isRootlike()) {
      if (this.commitRootlikeLayout(node)) {
        node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
        return true;
      }
    } else {
      if (this.commitAxisBasedLayout(node)) {
        node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
        return true;
      }
    }

    // Set our extents, combined with non-point neighbors.
    forEachCardinalDirection((dir: Direction) => {
      this.addLineBounds(node, dir);
    });

    if (this.commitInwardLayout(node) === true) {
      return true;
    }

    node.layout().setPhase(LayoutPhase.COMMITTED);

    // Needed a commit, so return true.
    return true;
  }

  private commitAxisBasedLayout(node: DirectionNode): boolean {
    // Layout based upon the axis preference.
    if (
      node.siblings().canonicalLayoutPreference() == PreferredAxis.PERPENDICULAR
    ) {
      const firstAxis: Axis = getPerpendicularAxis(node.parentDirection());

      // Check for nodes perpendicular to parent's direction
      const hasFirstAxisNodes: [Direction, Direction] = node
        .neighbors()
        .hasNodes(firstAxis);
      const oppositeFromParent: Direction = reverseDirection(
        node.parentDirection()
      );
      if (
        this.layoutAxis(node, hasFirstAxisNodes[0], hasFirstAxisNodes[1], false)
      ) {
        return true;
      }

      // Layout this node's second-axis child, if that child exists.
      if (node.neighbors().hasNode(oppositeFromParent)) {
        // Layout the second-axis child.
        if (this.layoutSingle(node, oppositeFromParent, true)) {
          return true;
        }
      }
    } else {
      // Layout this node's second-axis child, if that child exists.
      const oppositeFromParent: Direction = reverseDirection(
        node.parentDirection()
      );

      // Check for nodes perpendicular to parent's direction
      const perpendicularNodes: [Direction, Direction] = node
        .neighbors()
        .hasNodes(getPerpendicularAxis(node.parentDirection()));

      if (node.neighbors().hasNode(oppositeFromParent)) {
        // Layout the second-axis child.
        if (
          this.layoutSingle(
            node,
            oppositeFromParent,
            perpendicularNodes[0] === Direction.NULL &&
              perpendicularNodes[1] === Direction.NULL
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
          true
        )
      ) {
        return true;
      }
    }

    return false;
  }

  private commitRootlikeLayout(node: DirectionNode): boolean {
    if (
      node.siblings().getLayoutPreference() === PreferredAxis.HORIZONTAL ||
      node.siblings().getLayoutPreference() === PreferredAxis.PERPENDICULAR
    ) {
      // Root-like, so just lay out both axes.
      if (
        this.layoutAxis(
          node,
          Direction.BACKWARD,
          Direction.FORWARD,
          !node.neighbors().hasNode(Direction.UPWARD) &&
            !node.neighbors().hasNode(Direction.DOWNWARD)
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
        this.layoutAxis(
          node,
          Direction.UPWARD,
          Direction.DOWNWARD,
          !node.neighbors().hasNode(Direction.BACKWARD) &&
            !node.neighbors().hasNode(Direction.FORWARD)
        )
      ) {
        return true;
      }

      // This node is root-like, so it lays out the second-axis children in
      // the same method as the first axis.
      if (this.layoutAxis(node, Direction.BACKWARD, Direction.FORWARD, true)) {
        return true;
      }
    }

    return false;
  }

  private commitInwardLayout(node: DirectionNode): boolean {
    if (!node.neighbors().hasNode(Direction.INWARD)) {
      return false;
    }
    const nestedNode: DirectionNode = node.neighbors().nodeAt(Direction.INWARD);
    if (nestedNode.layout().phase() !== LayoutPhase.COMMITTED) {
      node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
      return true;
    }
    const nestedSize: Size = nestedNode.layout().extentSize(this.firstSize);
    if (node.getAlignment(Direction.INWARD) === Alignment.INWARD_VERTICAL) {
      node
        .neighbors()
        .setPosAt(
          Direction.INWARD,
          nestedNode.scale() *
            (nestedNode.layout().extentOffsetAt(Direction.DOWNWARD) -
              nestedSize.width() / 2),
          this.bodySize.height() / 2 -
            this.painter().getSeparation(node, Axis.Z, Direction.INWARD, true) /
              2 +
            nestedNode.scale() *
              (-nestedSize.height() +
                nestedNode.layout().extentOffsetAt(Direction.FORWARD))
        );
    } else {
      // console.log(this.horizontalPadding(), this.borderThickness());
      node
        .neighbors()
        .setPosAt(
          Direction.INWARD,
          this.bodySize.width() / 2 -
            this.painter().getSeparation(
              node,
              Axis.Z,
              Direction.INWARD,
              false
            ) /
              2 +
            nestedNode.scale() *
              (-nestedSize.width() +
                nestedNode.layout().extentOffsetAt(Direction.DOWNWARD)),
          nestedNode.scale() *
            (nestedNode.layout().extentOffsetAt(Direction.FORWARD) -
              nestedSize.height() / 2)
        );
    }

    return false;
  }

  private combineExtent(
    node: DirectionNode,
    childDirection: Direction,
    direction: Direction,
    lengthAdjustment: number,
    sizeAdjustment: number
  ): void {
    /* console.log(
                "combineExtent(" +
                nameDirection(direction) + ", " +
                lengthAdjustment + ", " +
                sizeAdjustment + ")"
            );*/
    // Calculate the new offset to this node's center.
    const child = node.neighbors().nodeAt(childDirection);
    const lengthOffset =
      node.layout().extentOffsetAt(direction) +
      lengthAdjustment -
      node.neighbors().nodeAt(childDirection).scale() *
        child.layout().extentOffsetAt(direction);

    // Combine the two extents in the given direction.
    /* console.log("Combining " + nameDirection(direction) + ", " );
            console.log("Child: " + nameLayoutPhase(child.layout().phase()));
            console.log("Length offset: " + lengthOffset);
            console.log("Size adjustment: " + sizeAdjustment);
            console.log("ExtentOffset : " +
              node.neighbors().at(direction).extentOffset);
            console.log("Scaled child ExtentOffset : " +
            (node.neighbors().nodeAt(childDirection).scale() * child.extentOffsetAt(direction))); */
    const e: Extent = node.layout().extentsAt(direction);
    const scale: number = node.neighbors().nodeAt(childDirection).scale();
    if (node.nodeFit() == Fit.LOOSE) {
      e.combineExtentAndSimplify(
        child.layout().extentsAt(direction),
        lengthOffset,
        sizeAdjustment,
        scale,
        this.bv
      );
    } else {
      e.combineExtent(
        child.layout().extentsAt(direction),
        lengthOffset,
        sizeAdjustment,
        scale
      );
    }

    // Adjust the length offset to remain positive.
    if (lengthOffset < 0) {
      // console.log("Adjusting negative extent offset.");
      node
        .layout()
        .setExtentOffsetAt(
          direction,
          node.layout().extentOffsetAt(direction) + Math.abs(lengthOffset)
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
    if (node.layout().extentOffsetAt(direction) < 0) {
      throw new Error("Extent offset must not be negative.");
    }
  }

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
   * @param {DirectionNode} node the node to work with
   * @param {Direction} childDirection the direction used for combining extents
   * @param {Alignment} alignment the alignment in the given direction
   * @param {number} separation the separation between nodes
   */
  private combineExtents(
    node: DirectionNode,
    childDirection: Direction,
    alignment: Alignment,
    separation: number
  ): void {
    // Combine an extent.
    // lengthAdjustment and sizeAdjustment are in this node's space.

    switch (childDirection) {
      case Direction.DOWNWARD:
        // Downward child.
        this.combineExtent(
          node,
          childDirection,
          Direction.DOWNWARD,
          alignment,
          separation
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.UPWARD,
          alignment,
          -separation
        );

        this.combineExtent(
          node,
          childDirection,
          Direction.FORWARD,
          separation,
          alignment
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.BACKWARD,
          separation,
          -alignment
        );
        break;
      case Direction.UPWARD:
        // Upward child.
        this.combineExtent(
          node,
          childDirection,
          Direction.DOWNWARD,
          alignment,
          -separation
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.UPWARD,
          alignment,
          separation
        );

        this.combineExtent(
          node,
          childDirection,
          Direction.FORWARD,
          -separation,
          alignment
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.BACKWARD,
          -separation,
          -alignment
        );
        break;
      case Direction.FORWARD:
        // Forward child.
        this.combineExtent(
          node,
          childDirection,
          Direction.DOWNWARD,
          separation,
          alignment
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.UPWARD,
          separation,
          -alignment
        );

        this.combineExtent(
          node,
          childDirection,
          Direction.FORWARD,
          alignment,
          separation
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.BACKWARD,
          alignment,
          -separation
        );
        break;
      case Direction.BACKWARD:
        // Backward child.
        this.combineExtent(
          node,
          childDirection,
          Direction.DOWNWARD,
          -separation,
          alignment
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.UPWARD,
          -separation,
          -alignment
        );

        this.combineExtent(
          node,
          childDirection,
          Direction.FORWARD,
          alignment,
          -separation
        );
        this.combineExtent(
          node,
          childDirection,
          Direction.BACKWARD,
          alignment,
          separation
        );
        break;
      default:
        throw createException(BAD_NODE_DIRECTION);
    }
  }

  // Layout a single node in the given direction.
  private layoutSingle(
    node: DirectionNode,
    direction: Direction,
    allowAxisOverlap: boolean
  ): boolean {
    if (!node.neighbors().hasNode(direction)) {
      return false;
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

    const child: DirectionNode = node.neighbors().nodeAt(direction);
    const reversed: Direction = reverseDirection(direction);
    const childExtent: Extent = child.layout().extentsAt(reversed);

    if (child.layout().phase() !== LayoutPhase.COMMITTED) {
      node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
      // console.log(Node.getLayoutNodes(findPaintGroup(child)));
      // console.log(namePreferredAxis(child.getLayoutPreference()));
      // console.log("Child's paint group is dirty: " +
      //   findPaintGroup(child).isDirty());
      // console.log(nameDirection(direction) + " Child " +
      //   nameType(child.type()) + " " + (child.id()) +
      //   " does not have a committed layout.
      //   Child's layout state is " +
      //   nameLayoutPhase(child.layout().phase()), child);
      return true;
    }

    // Separate the child from this node.

    let separationFromChild: number = node
      .layout()
      .extentsAt(direction)
      .separation(
        childExtent,
        node.layout().extentOffsetAt(direction) +
          alignment -
          node.neighbors().nodeAt(direction).scale() *
            child.layout().extentOffsetAt(reversed),
        allowAxisOverlap,
        node.neighbors().nodeAt(direction).scale(),
        LINE_THICKNESS / 2
      );
    // console.log("Calculated unpadded separation of " +
    //   separationFromChild + ".");

    // Add padding and ensure the child is not separated less than
    // it would be if the node was not offset by alignment.
    child.layout().size().copyTo(this.firstSize);

    if (getDirectionAxis(direction) == Axis.VERTICAL) {
      separationFromChild = Math.max(
        separationFromChild,
        node.neighbors().nodeAt(direction).scale() *
          (this.firstSize.height() / 2) +
          this.bodySize.height() / 2
      );
      separationFromChild +=
        this.painter().getSeparation(node, Axis.VERTICAL, direction, true) *
        node.neighbors().nodeAt(direction).scale();
    } else {
      separationFromChild = Math.max(
        separationFromChild,
        node.neighbors().nodeAt(direction).scale() *
          (this.firstSize.width() / 2) +
          this.bodySize.width() / 2
      );
      separationFromChild +=
        this.painter().getSeparation(node, Axis.HORIZONTAL, direction, false) *
        node.neighbors().nodeAt(direction).scale();
    }
    // console.log("Calculated padded separation of " +
    //   separationFromChild + ".");

    // Set the node's position.
    this.positionChild(node, direction, alignment, separationFromChild);

    // Combine the extents of the child and this node.
    this.combineExtents(node, direction, alignment, separationFromChild);

    return false;
  }

  // Layout a pair of nodes in the given directions.
  private layoutAxis(
    node: DirectionNode,
    firstDirection: Direction,
    secondDirection: Direction,
    allowAxisOverlap: boolean
  ): boolean {
    if (
      firstDirection === secondDirection &&
      firstDirection != Direction.NULL
    ) {
      throw createException(BAD_NODE_DIRECTION);
    }
    // Change the node direction to null if there is no node in that
    // direction.
    if (!node.neighbors().hasNode(firstDirection)) {
      firstDirection = Direction.NULL;
    }
    if (!node.neighbors().hasNode(secondDirection)) {
      secondDirection = Direction.NULL;
    }

    // Return if there are no directions.
    if (firstDirection == Direction.NULL && secondDirection == Direction.NULL) {
      return false;
    }

    // Test if this node has a first-axis child in only one direction.
    if (firstDirection == Direction.NULL || secondDirection == Direction.NULL) {
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
        node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
        return true;
      }
      return false;
    }

    /* console.log(
              "Laying out " +
              nameDirection(firstDirection) + " and " +
              nameDirection(secondDirection) + " children."
          );*/

    // This node has first-axis children in both directions.
    const firstNode: DirectionNode = node.neighbors().nodeAt(firstDirection);
    const secondNode: DirectionNode = node.neighbors().nodeAt(secondDirection);

    // Get the alignments for the children.
    const firstNodeAlignment: number = this.getAlignment(node, firstDirection);
    const secondNodeAlignment: number = this.getAlignment(
      node,
      secondDirection
    );
    // console.log("First alignment: " + firstNodeAlignment);
    // console.log("Second alignment: " + secondNodeAlignment);

    let separationBetweenChildren: number = firstNode
      .layout()
      .extentsAt(secondDirection)
      .separation(
        secondNode.layout().extentsAt(firstDirection),
        (node.neighbors().nodeAt(secondDirection).scale() /
          node.neighbors().nodeAt(firstDirection).scale()) *
          (secondNodeAlignment -
            secondNode.layout().extentOffsetAt(firstDirection)) -
          (firstNodeAlignment -
            firstNode.layout().extentOffsetAt(secondDirection)),
        true,
        node.neighbors().nodeAt(secondDirection).scale() /
          node.neighbors().nodeAt(firstDirection).scale(),
        0
      );
    separationBetweenChildren *= node
      .neighbors()
      .nodeAt(firstDirection)
      .scale();

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
              " " + nameType(this.neighbors().nodeAt(firstDirection).type()) +
              "'s " + nameDirection(secondDirection) +
              " extent (offset to center=" +
              this.neighbors().nodeAt(firstDirection).extentOffsetAt(secondDirection) +
              ")"
          );
          this.neighbors().nodeAt(firstDirection).extentsAt(secondDirection).forEach(
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
    switch (node.neighbors().nodeAt(firstDirection).axisOverlap()) {
      case AxisOverlap.PREVENTED:
        firstAxisOverlap = false;
        break;
      case AxisOverlap.ALLOWED:
        firstAxisOverlap = true;
        break;
    }
    let secondAxisOverlap: boolean = allowAxisOverlap;
    switch (node.neighbors().nodeAt(secondDirection).axisOverlap()) {
      case AxisOverlap.PREVENTED:
        secondAxisOverlap = false;
        break;
      case AxisOverlap.ALLOWED:
        secondAxisOverlap = true;
        break;
    }

    // Allow some overlap if we have both first-axis sides, but
    // nothing ahead on the second axis.
    let separationFromFirst: number = node
      .layout()
      .extentsAt(firstDirection)
      .separation(
        firstNode.layout().extentsAt(secondDirection),
        node.layout().extentOffsetAt(firstDirection) +
          firstNodeAlignment -
          node.neighbors().nodeAt(firstDirection).scale() *
            firstNode.layout().extentOffsetAt(secondDirection),
        firstAxisOverlap,
        node.neighbors().nodeAt(firstDirection).scale(),
        LINE_THICKNESS / 2
      );

    let separationFromSecond: number = node
      .layout()
      .extentsAt(secondDirection)
      .separation(
        secondNode.layout().extentsAt(firstDirection),
        node.layout().extentOffsetAt(secondDirection) +
          secondNodeAlignment -
          node.neighbors().nodeAt(secondDirection).scale() *
            secondNode.layout().extentOffsetAt(firstDirection),
        secondAxisOverlap,
        node.neighbors().nodeAt(secondDirection).scale(),
        LINE_THICKNESS / 2
      );

    /* console.log(
              "Separation from this " + nameType(this.type()) + " to " +
              nameDirection(firstDirection) + " " +
              nameType(this.neighbors().nodeAt(firstDirection).type()) + "=" +
              separationFromFirst
          );
          console.log(
              "Separation from this " + nameType(this.type()) + " to " +
              nameDirection(secondDirection) + " " +
              nameType(this.neighbors().nodeAt(secondDirection).type()) + "=" +
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
        separationBetweenChildren / 2
      );
      separationFromSecond = Math.max(
        separationFromSecond,
        separationBetweenChildren / 2
      );
    } else {
      // separationBetweenChildren
      //    < separationFromFirst + separationFromSecond
      // The separation between children is less than what this node
      // needs to separate each child from itself, so do nothing to
      // the separation values.
    }

    firstNode.layout().size(this.firstSize);
    secondNode.layout().size(this.secondSize);
    if (getDirectionAxis(firstDirection) === Axis.VERTICAL) {
      separationFromFirst = Math.max(
        separationFromFirst,
        node.neighbors().nodeAt(firstDirection).scale() *
          (this.firstSize.height() / 2) +
          this.bodySize.height() / 2
      );
      separationFromFirst +=
        this.painter().getSeparation(
          node,
          Axis.VERTICAL,
          firstDirection,
          true
        ) * node.neighbors().nodeAt(firstDirection).scale();

      separationFromSecond = Math.max(
        separationFromSecond,
        node.neighbors().nodeAt(secondDirection).scale() *
          (this.secondSize.height() / 2) +
          this.bodySize.height() / 2
      );
      separationFromSecond +=
        this.painter().getSeparation(
          node,
          Axis.VERTICAL,
          secondDirection,
          true
        ) * node.neighbors().nodeAt(secondDirection).scale();
    } else {
      separationFromFirst = Math.max(
        separationFromFirst,
        node.neighbors().nodeAt(firstDirection).scale() *
          (this.firstSize.width() / 2) +
          this.bodySize.width() / 2
      );
      separationFromFirst +=
        this.painter().getSeparation(
          node,
          Axis.HORIZONTAL,
          firstDirection,
          false
        ) * node.neighbors().nodeAt(firstDirection).scale();

      separationFromSecond = Math.max(
        separationFromSecond,
        node.neighbors().nodeAt(secondDirection).scale() *
          (this.secondSize.width() / 2) +
          this.bodySize.width() / 2
      );
      separationFromSecond +=
        this.painter().getSeparation(
          node,
          Axis.HORIZONTAL,
          secondDirection,
          false
        ) * node.neighbors().nodeAt(secondDirection).scale();
    }

    // Set the positions of the nodes.
    this.positionChild(
      node,
      firstDirection,
      firstNodeAlignment,
      separationFromFirst
    );
    this.positionChild(
      node,
      secondDirection,
      secondNodeAlignment,
      separationFromSecond
    );

    // Combine their extents.
    this.combineExtents(
      node,
      firstDirection,
      firstNodeAlignment,
      separationFromFirst
    );
    this.combineExtents(
      node,
      secondDirection,
      secondNodeAlignment,
      separationFromSecond
    );

    return false;
  }

  private sizeIn(
    node: DirectionNode,
    direction: Direction,
    bodySize: Size
  ): number {
    node.layout().size().copyTo(bodySize);
    if (isVerticalDirection(direction)) {
      return bodySize.height() / 2;
    } else {
      return bodySize.width() / 2;
    }
  }

  private addLineBounds(node: DirectionNode, given: Direction) {
    if (!node.neighbors().hasChild(given)) {
      return;
    }

    const perpAxis: Axis = getPerpendicularAxis(given);
    const dirSign: number = directionSign(given);

    let positiveOffset: number = node
      .layout()
      .extentOffsetAt(getPositiveDirection(perpAxis));
    let negativeOffset: number = node
      .layout()
      .extentOffsetAt(getNegativeDirection(perpAxis));

    if (dirSign < 0) {
      const lineSize: number = this.sizeIn(node, given, this.lineBounds);
      positiveOffset -= lineSize + node.neighbors().lineLengthAt(given);
      negativeOffset -= lineSize + node.neighbors().lineLengthAt(given);
    }

    if (node.nodeFit() == Fit.EXACT) {
      // Append the line-shaped bound.
      let lineSize: number;
      if (perpAxis === Axis.VERTICAL) {
        lineSize = this.bodySize.height() / 2;
      } else {
        lineSize = this.bodySize.width() / 2;
      }
      // lineSize = this.neighbors().nodeAt(given).scale() * LINE_THICKNESS / 2;
      node
        .layout()
        .extentsAt(getPositiveDirection(perpAxis))
        .combineBound(
          positiveOffset,
          node.neighbors().lineLengthAt(given),
          lineSize
        );
      node
        .layout()
        .extentsAt(getNegativeDirection(perpAxis))
        .combineBound(
          negativeOffset,
          node.neighbors().lineLengthAt(given),
          lineSize
        );
    }
  }
}
