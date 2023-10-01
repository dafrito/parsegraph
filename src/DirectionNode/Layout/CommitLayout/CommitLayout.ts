import { Direction, forEachCardinalDirection } from "../../../Direction";

import { DirectionNode, Fit } from "../..";

import { LayoutPhase, commitAxisBasedLayout } from "..";

import { LayoutPainter } from "./LayoutPainter";
import { addLineBounds } from "./addLineBounds";
import { commitInwardLayout } from "./commitInwardLayout";
import { commitRootlikeLayout } from "./commitRootlikeLayout";
import createException, { BAD_LAYOUT_STATE } from "../../../Exception";
import { Size } from "../../../Size";

const LINE_THICKNESS = 12;

/**
 * Computes the {@link Layout} for {@link DirectionNode} graphs.
 *
 * @see {@link LayoutPainter}
 */
export class CommitLayout {
  protected bodySize: Size;
  protected firstSize: Size;
  protected secondSize: Size;
  protected needsPosition: boolean;

  protected rootPaintGroup: DirectionNode;
  protected paintGroup?: DirectionNode;
  protected root?: DirectionNode;
  protected node?: DirectionNode;
  protected layoutPhase: number;
  private _painter: LayoutPainter;

  /**
   * Creates a new run of the layout algorithm.
   *
   * @param {DirectionNode} node - the root node
   * @param {LayoutPainter} painter - the painter used for sizing and painting information.
   */
  constructor(node: DirectionNode, painter: LayoutPainter) {
    this._painter = painter;
    this.bodySize = [NaN, NaN];
    this.firstSize = [NaN, NaN];
    this.secondSize = [NaN, NaN];
    this.reset(node);
  }

  protected initExtent(
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

  reset(node: DirectionNode): void {
    this.rootPaintGroup = node.neighbors().root();
    this.layoutPhase = 1;
    this.needsPosition = false;
    this.root = undefined;
    this.node = undefined;
    this.paintGroup = undefined;
    this.bodySize[0] = NaN;
    this.bodySize[1] = NaN;
    this.firstSize[0] = NaN;
    this.firstSize[1] = NaN;
    this.secondSize[0] = NaN;
    this.secondSize[1] = NaN;
  }

  startingNode(): DirectionNode {
    return this.rootPaintGroup;
  }

  protected painter(): LayoutPainter {
    return this._painter;
  }

  protected commitLayout(node: DirectionNode): boolean {
    // Do nothing if this node already has a layout committed.
    switch (node.layout().phase()) {
      case LayoutPhase.COMMITTED:
        return false;
      case LayoutPhase.NULL:
        // Check for invalid layout states.
        throw createException(BAD_LAYOUT_STATE);
      case LayoutPhase.IN_COMMIT:
        // Do not allow overlapping layout commits.
        throw createException(BAD_LAYOUT_STATE);
    }

    // Begin the layout.
    node.layout().setPhase(LayoutPhase.IN_COMMIT);

    // Set the node's size.
    const bodySize = this.bodySize;
    this.painter().size(node, bodySize);
    node.layout().setSize(bodySize);

    // This node's horizontal bottom, used with downward nodes.
    this.initExtent(
      node,
      Direction.DOWNWARD,
      // Length:
      bodySize[0],
      // Size:
      bodySize[1] / 2,
      // Offset to body center:
      bodySize[0] / 2
    );

    // This node's horizontal top, used with upward nodes.
    this.initExtent(
      node,
      Direction.UPWARD,
      // Length:
      bodySize[0],
      // Size:
      bodySize[1] / 2,
      // Offset to body center:
      bodySize[0] / 2
    );

    // This node's vertical back, used with backward nodes.
    this.initExtent(
      node,
      Direction.BACKWARD,
      // Length:
      bodySize[1],
      // Size:
      bodySize[0] / 2,
      // Offset to body center:
      bodySize[1] / 2
    );

    // This node's vertical front, used with forward nodes.
    this.initExtent(
      node,
      Direction.FORWARD,
      // Length:
      bodySize[1],
      // Size:
      bodySize[0] / 2,
      // Offset to body center:
      bodySize[1] / 2
    );

    if (node.layout().phase() === LayoutPhase.COMMITTED) {
      return true;
    }

    if (
      node.nodeFit() === Fit.NAIVE &&
      (node.neighbors().isRoot() || !isNaN(node.neighbors().parentX()))
    ) {
      node.layout().setPhase(LayoutPhase.COMMITTED);
      return false;
    }

    const thicknessFunc = this.painter().lineThickness;
    const thickness = thicknessFunc ? thicknessFunc(node) : LINE_THICKNESS;

    if (node.neighbors().isRootlike()) {
      if (
        commitRootlikeLayout(this.painter(), node, thickness, this.bodySize)
      ) {
        node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
        return true;
      }
    } else {
      if (
        commitAxisBasedLayout(this.painter(), node, thickness, this.bodySize)
      ) {
        node.layout().setPhase(LayoutPhase.NEEDS_COMMIT);
        return true;
      }
    }

    // Set our extents, combined with non-point neighbors.
    forEachCardinalDirection((dir: Direction) => {
      addLineBounds(node, dir, this.bodySize);
    });

    if (
      commitInwardLayout(
        this.painter(),
        node,
        this.bodySize,
        this.firstSize
      ) === true
    ) {
      return true;
    }

    node.layout().setPhase(LayoutPhase.COMMITTED);

    // Needed a commit, so return true.
    return true;
  }

  protected commitLayoutPhaseOne(): boolean {
    // Commit layout for all nodes.
    if (this.layoutPhase > 1) {
      return false;
    }

    // Start new layout.
    if (!this.paintGroup) {
      this.paintGroup = this.rootPaintGroup
        .paintGroup()
        .prev() as DirectionNode;
      this.root = this.paintGroup;
      this.node = this.root as DirectionNode;
      this.needsPosition = false;
    }

    if (this.root?.layout().needsCommit()) {
      this.needsPosition = true;
      do {
        // Loop back to the first node, from the root.
        this.node = this.node?.siblings().next() as DirectionNode;
        if (this.node.layout().needsCommit()) {
          this.commitLayout(this.node);
          this.node.layout().invalidateGroupPos();
          this.node.layout().invalidateAbsolutePos();
          this.node.paintGroups().setPaintGroupNode(this.paintGroup);
          return true;
        }
      } while (this.node !== this.root);
    } else {
      this.needsPosition = Boolean(
        this.needsPosition || this.root?.layout().needsPosition()
      );

      if (this.needsPosition) {
        do {
          if (!this.node) {
            throw new Error("Node must not be undefined");
          }
          const layout = this.node.layout();
          layout.invalidateAbsolutePos();
          layout.invalidateGroupPos();
          layout.commitGroupPos();
          this.node = this.node.siblings().prev() as DirectionNode;
        } while (this.node !== this.root);
      }
    }

    const paint = this.painter().paint;
    if (
      this.needsPosition &&
      paint &&
      paint.call(this.painter(), this.paintGroup)
    ) {
      return true;
    }

    if (this.paintGroup === this.rootPaintGroup) {
      ++this.layoutPhase;
      this.paintGroup = undefined;
      return false;
    }

    this.paintGroup = this.paintGroup.paintGroup().prev() as DirectionNode;
    this.root = this.paintGroup;
    this.node = this.root;
    return true;
  }

  protected commitLayoutPhaseTwo(): boolean {
    if (!this.needsPosition || this.layoutPhase !== 2) {
      return false;
    }

    // Start second phase of layout
    if (!this.paintGroup) {
      this.paintGroup = this.rootPaintGroup;
      this.root = this.paintGroup;
      this.node = undefined;
    }

    if (
      this.paintGroup?.layout().needsCommit() ||
      this.paintGroup?.layout().needsPosition()
    ) {
      if (!this.node) {
        this.node = this.paintGroup.siblings().prev() as DirectionNode;
      }
      // Loop from the root to the last node.
      const layout = this.node.layout();
      layout.invalidateAbsolutePos();
      layout.invalidateGroupPos();
      layout.commitGroupPos();
      this.node = this.node.siblings().prev() as DirectionNode;
      return true;
    }

    this.paintGroup = this.paintGroup?.paintGroup().next() as DirectionNode;
    if (this.paintGroup === this.rootPaintGroup) {
      ++this.layoutPhase;
      this.needsPosition = false;
      this.paintGroup = undefined;
      return false;
    }

    this.root = this.paintGroup;
    this.node = undefined;
    return true;
  }

  protected commitLayoutPhaseThree(): boolean {
    if (this.layoutPhase !== 3) {
      return false;
    }

    if (!this.paintGroup) {
      this.paintGroup = this.rootPaintGroup;
    }

    const layout = this.paintGroup?.layout();
    if (layout) {
      layout.invalidateAbsolutePos();
      layout.commitAbsolutePos();
    }

    this.paintGroup = this.paintGroup?.paintGroup().next() as DirectionNode;
    if (this.paintGroup === this.rootPaintGroup) {
      ++this.layoutPhase;
      this.needsPosition = false;
      return false;
    }

    return true;
  }

  /**
   * Traverse the graph depth-first, committing each node's layout in turn.
   *
   * @return {boolean} true if the algorithm needs more cranks.
   */
  crank(): boolean {
    if (
      this.commitLayoutPhaseOne() ||
      this.commitLayoutPhaseTwo() ||
      this.commitLayoutPhaseThree()
    ) {
      return true;
    }

    this.reset(this.rootPaintGroup);
    return false;
  }
}
