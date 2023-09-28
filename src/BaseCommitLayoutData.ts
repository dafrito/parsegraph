import { Direction, DirectionNode, LayoutState } from "./direction";
import createException, { BAD_LAYOUT_STATE } from "./Exception";
import Size from "./size";
import { elapsed } from "parsegraph-timing";
import { log, logc, logEnterc, logLeave } from "./log";
import LayoutPainter from "./LayoutPainter";

export default class BaseCommitLayoutData {
  bodySize: Size;
  needsPosition: boolean;

  rootPaintGroup: DirectionNode;
  paintGroup?: DirectionNode;
  root?: DirectionNode;
  node?: DirectionNode;
  layoutPhase: number;
  _painter: LayoutPainter;

  constructor(node: DirectionNode, painter: LayoutPainter) {
    this._count = 0;
    this._painter = painter;
    this.layoutPhase = 1;
    this.rootPaintGroup = node.root();
    this.bodySize = new Size();
    this.needsPosition = false;
  }

  protected initExtent(
    node: DirectionNode,
    inDirection: Direction,
    length: number,
    size: number,
    offset: number
  ) {
    const extent = node.getLayout().extentsAt(inDirection);
    extent.clear();
    extent.appendLS(length, size);
    node.getLayout().setExtentOffsetAt(inDirection, offset);
    // console.log(new Error("OFFSET = " + offset));
  }

  painter(): LayoutPainter {
    return this._painter;
  }

  protected commitLayout(node: DirectionNode): boolean {
    // Do nothing if this node already has a layout committed.
    switch (node.getLayoutState()) {
      case LayoutState.COMMITTED:
        return false;
      case LayoutState.NULL:
        // Check for invalid layout states.
        throw createException(BAD_LAYOUT_STATE);
      case LayoutState.IN_COMMIT:
        // Do not allow overlapping layout commits.
        throw createException(BAD_LAYOUT_STATE);
    }

    // Begin the layout.
    node.setLayoutState(LayoutState.IN_COMMIT);

    const bodySize = this.bodySize;
    this.painter().size(node, bodySize);

    node.getLayout().setSize(bodySize);

    // This node's horizontal bottom, used with downward nodes.
    this.initExtent(
      node,
      Direction.DOWNWARD,
      // Length:
      bodySize.width(),
      // Size:
      bodySize.height() / 2,
      // Offset to body center:
      bodySize.width() / 2
    );

    // This node's horizontal top, used with upward nodes.
    this.initExtent(
      node,
      Direction.UPWARD,
      // Length:
      bodySize.width(),
      // Size:
      bodySize.height() / 2,
      // Offset to body center:
      bodySize.width() / 2
    );

    // This node's vertical back, used with backward nodes.
    this.initExtent(
      node,
      Direction.BACKWARD,
      // Length:
      bodySize.height(),
      // Size:
      bodySize.width() / 2,
      // Offset to body center:
      bodySize.height() / 2
    );

    // This node's vertical front, used with forward nodes.
    this.initExtent(
      node,
      Direction.FORWARD,
      // Length:
      bodySize.height(),
      // Size:
      bodySize.width() / 2,
      // Offset to body center:
      bodySize.height() / 2
    );

    // Implementations should actually commit the layout here.
    // node.setLayoutState(LayoutState.COMMITTED);

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
    }

    if (this.root?.needsCommit()) {
      this.needsPosition = true;
      do {
        // Loop back to the first node, from the root.
        this.node = this.node?.siblings().next() as DirectionNode;
        if (this.node.needsCommit()) {
          this.commitLayout(this.node);
          this.node.getLayout().invalidateGroupPos();
          this.node.getLayout().invalidateAbsolutePos();
          this.node.setPaintGroupRoot(this.paintGroup);
          return true;
        }
      } while (this.node !== this.root);
    } else {
      this.needsPosition = Boolean(
        this.needsPosition || this.root?.getLayout().needsPosition()
      );
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
      this.paintGroup?.needsCommit() ||
      this.paintGroup?.getLayout().needsPosition()
    ) {
      if (!this.node) {
        this.node = this.paintGroup.siblings().prev() as DirectionNode;
      }
      // Loop from the root to the last node.
      const layout = this.node.getLayout();
      layout._absoluteDirty = true;
      layout._hasGroupPos = false;
      layout.commitGroupPos();
      this.node = this.node.siblings().prev() as DirectionNode;
      return true;
    }

    const layout = this.paintGroup?.getLayout();
    if (layout) {
      ++layout._absoluteVersion;
      layout._absoluteDirty = true;
      layout.commitAbsolutePos();
    }

    if (this.painter().paint(this.paintGroup)) {
      return true;
    }
    this.paintGroup = this.paintGroup?.paintGroup().next() as DirectionNode;
    if (this.paintGroup === this.rootPaintGroup) {
      ++this.layoutPhase;
      this.needsPosition = false;
      return false;
    }

    this.root = this.paintGroup;
    this.node = undefined;
    return true;
  }

  _count: number;

  /**
   * Traverse the graph depth-first, committing each node's layout in turn.
   * @param {number} timeout milliseconds to run layout, optional
   * @return {Function} A function to resume layout where stopped, if applicable. Otherwise null
   */
  crank(): boolean {
    if (this._count++ > 10000) {
      throw new Error("Overflow");
    }
    return this.commitLayoutPhaseOne() || this.commitLayoutPhaseTwo();
  }
}
