import Direction, {
  readDirection,
  DirectionCaret,
} from 'parsegraph-direction';
import LayoutNode from './LayoutNode';
import Fit from './Fit';
import AxisOverlap, {readAxisOverlap} from './AxisOverlap';
import Alignment, {readAlignment} from './Alignment';

// The scale at which shrunk nodes are shrunk.
export const SHRINK_SCALE = 0.85;

export default class LayoutCaret<T extends LayoutNode> extends DirectionCaret<T> {
  clone(): LayoutCaret<T> {
    return new LayoutCaret(this.palette(), this.node());
  }

  spawn(
      inDirection: Direction | string,
      newType?: any,
      newAlignmentMode?: Alignment | string,
  ): T {
    const created = super.spawn(inDirection, newType);
    created.setNodeFit(this.node().nodeFit());

    // Use the given alignment mode.
    if (newAlignmentMode !== undefined) {
      newAlignmentMode = readAlignment(newAlignmentMode);
      this.align(inDirection, newAlignmentMode);
      if (newAlignmentMode !== Alignment.NONE) {
        this.node().setNodeFit(Fit.EXACT);
      }
    }

    return created;
  }

  spawnMove(
      inDirection: Direction | string,
      newType: T | string,
      newAlignmentMode?: Alignment | string,
  ): T {
    const created: T = this.spawn(inDirection, newType, newAlignmentMode);
    this.move(inDirection);
    return created;
  }

  align(
      inDirection: Direction | string,
      newAlignmentMode: Alignment | string,
  ): void {
    // Interpret the arguments.
    inDirection = readDirection(inDirection);
    newAlignmentMode = readAlignment(newAlignmentMode);

    this.node().setNodeAlignmentMode(inDirection, newAlignmentMode);
    if (newAlignmentMode != Alignment.NONE) {
      this.node().setNodeFit(Fit.EXACT);
    }
  }

  overlapAxis(...args: any[]): void {
    if (args.length === 0) {
      this.node().setAxisOverlap(AxisOverlap.ALLOWED);
      return;
    }
    if (args.length === 1) {
      this.node().setAxisOverlap(readAxisOverlap(args[0]));
      return;
    }
    const inDirection: Direction = readDirection(args[0]);
    const newAxisOverlap: AxisOverlap = readAxisOverlap(args[1]);
    this.node().setAxisOverlap(inDirection, newAxisOverlap);
  }

  axisOverlap(...args: any[]): void {
    return this.overlapAxis(...args);
  }

  shrink(inDirection?: Direction | string): void {
    let node: T = this.node();
    if (arguments.length > 0) {
      node = node.nodeAt(readDirection(inDirection));
    }
    if (node) {
      node.setScale(SHRINK_SCALE);
    }
  }

  grow(inDirection?: Direction | string): void {
    let node: T = this.node();
    if (arguments.length > 0) {
      node = node.nodeAt(readDirection(inDirection));
    }
    if (node) {
      node.setScale(1.0);
    }
  }

  fitExact(inDirection?: Direction | string): void {
    let node: T = this.node();
    if (arguments.length > 0) {
      node = node.nodeAt(readDirection(inDirection));
    }
    node.setNodeFit(Fit.EXACT);
  }

  fitLoose(inDirection?: Direction | string): void {
    let node: T = this.node();
    if (arguments.length > 0) {
      node = node.nodeAt(readDirection(inDirection));
    }
    node.setNodeFit(Fit.LOOSE);
  }

  fitNaive(inDirection?: Direction | string): void {
    let node: T = this.node();
    if (arguments.length > 0) {
      node = node.nodeAt(readDirection(inDirection));
    }
    node.setNodeFit(Fit.NAIVE);
  }
}