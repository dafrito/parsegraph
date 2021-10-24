import { Direction, LayoutState } from "parsegraph-direction";
import LayoutNode from "./LayoutNode";
import createException, { BAD_LAYOUT_STATE } from "./Exception";
import Size from "parsegraph-size";
import { elapsed } from "parsegraph-timing";

export default class BaseCommitLayoutData {
  bodySize: Size;
  needsPosition: boolean;
  timeout: number;

  rootPaintGroup: LayoutNode;
  paintGroup: LayoutNode;
  root: LayoutNode;
  node: LayoutNode;
  layoutPhase: number;

  constructor(node: LayoutNode, timeout?: number) {
    this.layoutPhase = 1;
    this.rootPaintGroup = node;
    this.bodySize = new Size();
    this.paintGroup = null;
    this.root = null;
    this.node = null;
    this.needsPosition = false;
    this.timeout = timeout;
  }

  restarter(): Function {
    return (timeout: number) => {
      this.commitLayoutLoop(timeout || this.timeout);
    };
  }

  initExtent(
    node: LayoutNode,
    inDirection: Direction,
    length: number,
    size: number,
    offset: number
  ) {
    const extent = node.extentsAt(inDirection);
    extent.clear();
    extent.appendLS(length, size);
    node.setExtentOffsetAt(inDirection, offset);
    // console.log(new Error("OFFSET = " + offset));
  }

  commitLayout(node: LayoutNode): boolean {
    // Do nothing if this node already has a layout committed.
    if (node._layoutState === LayoutState.COMMITTED) {
      return false;
    }

    // Check for invalid layout states.
    if (node._layoutState === LayoutState.NULL) {
      throw createException(BAD_LAYOUT_STATE);
    }

    // Do not allow overlapping layout commits.
    if (node._layoutState === LayoutState.IN_COMMIT) {
      throw createException(BAD_LAYOUT_STATE);
    }

    // Begin the layout.
    node._layoutState = LayoutState.IN_COMMIT;

    const bodySize = node.size(this.bodySize);

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
    // node._layoutState = LayoutState.COMMITTED;

    // Needed a commit, so return true.
    return true;
  }

  commitLayoutPhaseOne(pastTime: Function): boolean {
    // Commit layout for all nodes.
    while (this.layoutPhase === 1) {
      if (this.paintGroup === null) {
        // console.log("Beginning new commit layout phase 1");
        this.paintGroup = this.rootPaintGroup._paintGroupNext;
        this.root = this.paintGroup;
        this.node = this.root;
      } else {
        // console.log("Continuing commit layout phase 1");
      }
      if (pastTime(this.node._id)) {
        // console.log("Ran out of time between groups during
        //   phase 1 (Commit layout, timeout=" + timeout +")");
        return false;
      }
      if (this.root.needsCommit()) {
        this.needsPosition = true;
        do {
          // Loop back to the first node, from the root.
          this.node = this.node._layoutNext;
          if (this.node.needsCommit()) {
            this.commitLayout(this.node);
            if (this.node.needsCommit()) {
              // Node had a child that needed a commit, so reset the layout.
              // console.log("Resetting layout");
              this.paintGroup = null;
              return false;
            }
            this.node._currentPaintGroup = this.paintGroup;
          }
          if (pastTime(this.node._id)) {
            // console.log("Ran out of time mid-group during
            //   phase 1 (Commit layout)");
            return false;
          }
        } while (this.node !== this.root);
      } else {
        this.needsPosition = this.needsPosition || this.root.needsPosition();
      }
      if (this.paintGroup === this.rootPaintGroup) {
        // console.log("Commit layout phase 1 done");
        ++this.layoutPhase;
        this.paintGroup = null;
        break;
      }
      this.paintGroup = this.paintGroup._paintGroupNext;
      this.root = this.paintGroup;
      this.node = this.root;
    }
    return true;
  }

  commitLayoutPhaseTwo(pastTime: Function): boolean {
    // Calculate position.
    while (this.needsPosition && this.layoutPhase === 2) {
      // console.log("Now in layout phase 2");
      if (this.paintGroup === null) {
        // console.log("Beginning layout phase 2");
        this.paintGroup = this.rootPaintGroup;
        this.root = this.paintGroup;
        this.node = this.root;
      } else {
        // console.log("Continuing layout phase 2");
      }
      // console.log("Processing position for ", paintGroup);
      if (pastTime(this.paintGroup._id)) {
        // console.log("Ran out of time between groups during
        //   phase 2 (Commit group position). Next node is ", paintGroup);
        return false;
      }
      if (this.paintGroup.needsPosition() || this.node) {
        // console.log(paintGroup + " needs a position update");
        if (!this.node) {
          this.node = this.paintGroup;
        }
        do {
          // Loop from the root to the last node.
          this.node._absoluteDirty = true;
          this.node._hasGroupPos = false;
          this.node.commitGroupPos();
          this.node = this.node._layoutPrev;
          if (pastTime(this.node._id)) {
            // console.log("Ran out of time mid-group during
            //   phase 2 (Commit group position). Next node is ", node);
            this.paintGroup._hasGroupPos = false;
            return false;
          }
        } while (this.node !== this.root);
      } else {
        // console.log(paintGroup + " does not need a position update.");
      }
      ++this.paintGroup._absoluteVersion;
      this.paintGroup._absoluteDirty = true;
      this.paintGroup.commitAbsolutePos();
      this.paintGroup = this.paintGroup._paintGroupPrev;
      if (this.paintGroup === this.rootPaintGroup) {
        // console.log("Commit layout phase 2 done");
        ++this.layoutPhase;
        break;
      }
      this.root = this.paintGroup;
      this.node = null;
    }
    this.needsPosition = false;
    return true;
  }

  /**
   * Traverse the graph depth-first, committing each node's layout in turn.
   * @param {number} timeout milliseconds to run layout, optional
   * @return {Function} A function to resume layout where stopped, if applicable. Otherwise null
   */
  commitLayoutLoop(timeout: number): Function {
    const restart = this.restarter();
    if (timeout <= 0) {
      return restart;
    }

    const startTime: Date = new Date();
    let i: number = 0;
    const pastTime = function (val?: any) {
      ++i;
      if (i % 10 === 0) {
        const ct = new Date();
        const el = elapsed(startTime, ct);
        if (el > 4 * 1000) {
          console.log(val);
        }
        if (el > 5 * 1000) {
          throw new Error("Commit Layout is taking too long");
        }
        if (timeout !== undefined && el > timeout) {
          return true;
        }
      }
      return false;
    };

    if (!this.commitLayoutPhaseOne(pastTime)) {
      return restart;
    }
    if (!this.commitLayoutPhaseTwo(pastTime)) {
      return restart;
    }
    return null;
  }
}
