import { Extent } from "../Extent";

import {
  Direction,
  Axis,
  getPerpendicularAxis,
  getPositiveDirection,
  getNegativeDirection,
  getDirectionAxis,
  reverseDirection,
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

import { BaseCommitLayout } from "./BaseCommitLayout";
import { LayoutPainter } from "./LayoutPainter";
import { findConsecutiveLength } from "./findConsecutiveLength";
import { combineExtents } from "./CombineExtents";
import { AddLineBounds } from "./AddLineBounds";
import { positionChild } from "./positionChild";
import { getAlignment } from "./getAlignment";
import { layoutSingle } from "./LayoutSingle";

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
  private _lineBounds: AddLineBounds;

  /**
   * Creates a new run of the layout algorithm.
   *
   * @param {DirectionNode} node - the root node
   * @param {LayoutPainter} painter - the painter used for sizing and painting information.
   */
  constructor(node: DirectionNode, painter: LayoutPainter) {
    super(node, painter);
    this._lineBounds = new AddLineBounds();
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
      (node.neighbors().isRoot() || !isNaN(node.neighbors().parentX()))
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
      this._lineBounds.addLineBounds(node, dir, this.bodySize);
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
      const firstAxis: Axis = getPerpendicularAxis(
        node.neighbors().parentDirection()
      );

      // Check for nodes perpendicular to parent's direction
      const hasFirstAxisNodes: [Direction, Direction] = node
        .neighbors()
        .hasNodes(firstAxis);
      const oppositeFromParent: Direction = reverseDirection(
        node.neighbors().parentDirection()
      );
      if (
        this.layoutAxis(node, hasFirstAxisNodes[0], hasFirstAxisNodes[1], false)
      ) {
        return true;
      }

      // Layout this node's second-axis child, if that child exists.
      if (node.neighbors().hasNode(oppositeFromParent)) {
        // Layout the second-axis child.
        if (layoutSingle(node, oppositeFromParent, true, LINE_THICKNESS, this.bodySize, this.firstSize, this.painter())) {
          return true;
        }
      }
    } else {
      // Layout this node's second-axis child, if that child exists.
      const oppositeFromParent: Direction = reverseDirection(
        node.neighbors().parentDirection()
      );

      // Check for nodes perpendicular to parent's direction
      const perpendicularNodes: [Direction, Direction] = node
        .neighbors()
        .hasNodes(getPerpendicularAxis(node.neighbors().parentDirection()));

      if (node.neighbors().hasNode(oppositeFromParent)) {
        // Layout the second-axis child.
        if (
          layoutSingle(
            node,
            oppositeFromParent,
            perpendicularNodes[0] === Direction.NULL &&
              perpendicularNodes[1] === Direction.NULL,
            LINE_THICKNESS,
            this.bodySize,
            this.firstSize,
            this.painter()
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

  private getSeparation(node: DirectionNode, axis: Axis, dir: Direction, preferVertical: boolean): number {
    const getSeparation = this.painter().getSeparation;
    if (!getSeparation) {
      return 0;
    }
    return getSeparation(
      node,
      axis,
      dir,
      preferVertical
    );
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
    nestedNode.layout().extentSize(this.firstSize);
    const nestedSize = this.firstSize;
    if (
      node.neighbors().getAlignment(Direction.INWARD) ===
      Alignment.INWARD_VERTICAL
    ) {
      node
        .neighbors()
        .setPosAt(
          Direction.INWARD,
          nestedNode.scale() *
            (nestedNode.layout().extentOffsetAt(Direction.DOWNWARD) -
              nestedSize[0] / 2),
          this.bodySize[1] / 2 -
            this.getSeparation(node, Axis.Z, Direction.INWARD, true) /
              2 +
            nestedNode.scale() *
              (-nestedSize[1] +
                nestedNode.layout().extentOffsetAt(Direction.FORWARD))
        );
    } else {
      // console.log(this.horizontalPadding(), this.borderThickness());
      node
        .neighbors()
        .setPosAt(
          Direction.INWARD,
          this.bodySize[0] / 2 -
            this.getSeparation(
              node,
              Axis.Z,
              Direction.INWARD,
              false
            ) /
              2 +
            nestedNode.scale() *
              (-nestedSize[0] +
                nestedNode.layout().extentOffsetAt(Direction.DOWNWARD)),
          nestedNode.scale() *
            (nestedNode.layout().extentOffsetAt(Direction.FORWARD) -
              nestedSize[1] / 2)
        );
    }

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
      if (layoutSingle(node, firstAxisDirection, allowAxisOverlap, LINE_THICKNESS, this.bodySize, this.firstSize, this.painter())) {
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
    const firstNodeAlignment: number = getAlignment(node, firstDirection);
    const secondNodeAlignment: number = getAlignment(
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
    switch (node.neighbors().nodeAt(firstDirection).neighbors().axisOverlap()) {
      case AxisOverlap.PREVENTED:
        firstAxisOverlap = false;
        break;
      case AxisOverlap.ALLOWED:
        firstAxisOverlap = true;
        break;
    }
    let secondAxisOverlap: boolean = allowAxisOverlap;
    switch (
      node.neighbors().nodeAt(secondDirection).neighbors().axisOverlap()
    ) {
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
          (this.firstSize[1] / 2) +
          this.bodySize[1] / 2
      );
      separationFromFirst +=
        this.getSeparation(
          node,
          Axis.VERTICAL,
          firstDirection,
          true
        ) * node.neighbors().nodeAt(firstDirection).scale();

      separationFromSecond = Math.max(
        separationFromSecond,
        node.neighbors().nodeAt(secondDirection).scale() *
          (this.secondSize[1] / 2) +
          this.bodySize[1] / 2
      );
      separationFromSecond +=
        this.getSeparation(
          node,
          Axis.VERTICAL,
          secondDirection,
          true
        ) * node.neighbors().nodeAt(secondDirection).scale();
    } else {
      separationFromFirst = Math.max(
        separationFromFirst,
        node.neighbors().nodeAt(firstDirection).scale() *
          (this.firstSize[0] / 2) +
          this.bodySize[0] / 2
      );
      separationFromFirst +=
        this.getSeparation(
          node,
          Axis.HORIZONTAL,
          firstDirection,
          false
        ) * node.neighbors().nodeAt(firstDirection).scale();

      separationFromSecond = Math.max(
        separationFromSecond,
        node.neighbors().nodeAt(secondDirection).scale() *
          (this.secondSize[0] / 2) +
          this.bodySize[0] / 2
      );
      separationFromSecond +=
        this.getSeparation(
          node,
          Axis.HORIZONTAL,
          secondDirection,
          false
        ) * node.neighbors().nodeAt(secondDirection).scale();
    }

    // Set the positions of the nodes.
    positionChild(
      node,
      firstDirection,
      firstNodeAlignment,
      separationFromFirst
    );
    positionChild(
      node,
      secondDirection,
      secondNodeAlignment,
      separationFromSecond
    );

    // Combine their extents.
    combineExtents(
      node,
      firstDirection,
      firstNodeAlignment,
      separationFromFirst
    );
    combineExtents(
      node,
      secondDirection,
      secondNodeAlignment,
      separationFromSecond
    );

    return false;
  }

}
