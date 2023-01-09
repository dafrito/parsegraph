import { Direction, LayoutState } from "parsegraph-direction";
import LayoutNode from "./LayoutNode";
import createException, { BAD_LAYOUT_STATE } from "./Exception";
import Size from "parsegraph-size";
import { elapsed } from "parsegraph-timing";
import {log, logc, logEnterc, logLeave} from './log';

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
      return this.commitLayoutLoop(timeout || this.timeout);
    };
  }

  initExtent(
    node: LayoutNode,
    inDirection: Direction,
    length: number,
    size: number,
    offset: number
  ) {
    const extent = node.value().getLayout().extentsAt(inDirection);
    extent.clear();
    extent.appendLS(length, size);
    node.value().getLayout().setExtentOffsetAt(inDirection, offset);
    // console.log(new Error("OFFSET = " + offset));
  }

  commitLayout(node: LayoutNode): boolean {
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

    const bodySize = node.value().size(this.bodySize);

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

  commitLayoutPhaseOne(pastTime: Function): boolean {
    // Commit layout for all nodes.
    while (this.layoutPhase === 1) {
      if (this.paintGroup === null) {
        logEnterc("Layout", "Beginning new commit layout phase 1");
        this.paintGroup = this.rootPaintGroup.paintGroup().next() as LayoutNode;
        this.root = this.paintGroup;
        this.node = this.root as LayoutNode;
      } else {
        logEnterc("Layout", "Continuing commit layout phase 1");
      }
      if (pastTime(this.node.id())) {
        logLeave("Ran out of time between groups during phase 1 (Commit layout)");
        return false;
      }
      if (this.root.needsCommit()) {
        this.needsPosition = true;
        do {
          // Loop back to the first node, from the root.
          this.node = this.node.siblings().next() as LayoutNode;
          if (this.node.needsCommit()) {
            log("Commiting layout for node {0}", this.node.state().id());
            this.commitLayout(this.node);
            this.node.value().getLayout().invalidateGroupPos();
            if (this.node.needsCommit()) {
              logLeave("Node had a child that needed commit; resetting layout");
              this.paintGroup = null;
              return false;
            }
            this.node.setPaintGroupRoot(this.paintGroup);
          }
          if (pastTime(this.node.id())) {
            logLeave("Ran out of time mid-group during phase 1 (Commit layout)");
            return false;
          }
        } while (this.node !== this.root);
      } else {
        this.needsPosition =
          this.needsPosition ||
          this.root.needsCommit() ||
          this.root.value().getLayout().needsPosition();
      }
      if (this.paintGroup === this.rootPaintGroup) {
        logLeave("Commit layout phase 1 done");
        ++this.layoutPhase;
        this.paintGroup = null;
        break;
      }
      this.paintGroup = this.paintGroup.paintGroup().next() as LayoutNode;
      this.root = this.paintGroup;
      this.node = this.root;
      logLeave();
    }
    return true;
  }

  commitLayoutPhaseTwo(pastTime: Function): boolean {
    // Calculate position.
    while (this.needsPosition && this.layoutPhase === 2) {
      if (this.paintGroup === null) {
        logEnterc("Layout", "Beginning layout phase 2");
        this.paintGroup = this.rootPaintGroup;
        this.root = this.paintGroup;
        this.node = this.root;
      } else {
        logEnterc("Layout", "Continuing layout phase 2");
      }
      log("Processing position for paint group {0}", this.paintGroup.state().id());
      if (pastTime(this.paintGroup.id())) {
        logLeave("Ran out of time between groups during phase 2 (Commit group position). Next node is {0}", this.paintGroup.state().id());
        return false;
      }
      if (
        this.paintGroup.needsCommit() ||
        this.paintGroup.value().getLayout().needsPosition() ||
        this.node
      ) {
        log("Paint group {0} needs a position update", this.paintGroup.state().id());
        if (!this.node) {
          this.node = this.paintGroup;
        }
        do {
          // Loop from the root to the last node.
          const layout = this.node.value().getLayout();
          layout._absoluteDirty = true;
          layout._hasGroupPos = false;
          layout.commitGroupPos();
          this.node = this.node.siblings().prev() as LayoutNode;
          if (pastTime(this.node.id())) {
            logLeave("Ran out of time mid-group during phase 2 (Commit group position). Next node is {0}", this.node.state().id());
            this.paintGroup.value().getLayout()._hasGroupPos = false;
            return false;
          }
        } while (this.node !== this.root);
      } else {
        log("{0} does not need a position update.", this.paintGroup.state().id());
      }
      const layout = this.paintGroup.value().getLayout();
      ++layout._absoluteVersion;
      layout._absoluteDirty = true;
      layout.commitAbsolutePos();
      this.paintGroup = this.paintGroup.paintGroup().next() as LayoutNode;
      if (this.paintGroup === this.rootPaintGroup) {
        logLeave("Commit layout phase 2 done");
        ++this.layoutPhase;
        break;
      }
      this.root = this.paintGroup;
      this.node = null;
      logLeave();
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
          logc("Layout timeouts", "Layout timed out!");
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
