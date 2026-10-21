/* eslint-disable require-jsdoc */
import { DirectionCaret, SHRINK_SCALE } from "./DirectionCaret";
import { Direction } from "./Direction";
import { DirectionNode, Alignment, Fit } from "./DirectionNode";
import { LayoutPhase } from "./DirectionNode/Layout/LayoutPhase";

function inwardCaret() {
  const caret = new DirectionCaret("root");
  const root = caret.node();
  const child = caret.spawn(Direction.INWARD, "inner");
  return { caret, root, child };
}

describe("Caret direction and parent-alignment regressions", () => {
  it("disconnects numeric INWARD rather than detaching the current node", () => {
    const { caret, root, child } = inwardCaret();
    expect(caret.disconnect(Direction.INWARD)).toBe(child);
    expect(root.neighbors().hasNode(Direction.INWARD)).toBe(false);
    expect(child.neighbors().isRoot()).toBe(true);
    expect(caret.node()).toBe(root);
  });

  it("creases numeric INWARD rather than the current node", () => {
    const { caret, root, child } = inwardCaret();
    caret.crease(Direction.INWARD);
    expect(child.paintGroups().isPaintGroup()).toBeTruthy();
    expect(root.paintGroup().dump()).toEqual([root, child]);
  });

  it("uncreases numeric INWARD rather than the current node", () => {
    const { caret, root, child } = inwardCaret();
    child.paintGroups().crease();
    caret.uncrease(Direction.INWARD);
    expect(child.paintGroups().isPaintGroup()).toBeFalsy();
    expect(root.paintGroup().dump()).toEqual([root]);
  });

  it("queries the inward neighbor's paint group rather than the root's", () => {
    const { caret, child } = inwardCaret();
    expect(caret.isCreased()).toBe(true);
    expect(caret.isCreased(Direction.INWARD)).toBe(false);
    child.paintGroups().crease();
    expect(caret.isCreased(Direction.INWARD)).toBe(true);
  });

  it("shrinks numeric INWARD without scaling the parent", () => {
    const { caret, root, child } = inwardCaret();
    caret.shrink(Direction.INWARD);
    expect(child.scale()).toBe(SHRINK_SCALE);
    expect(root.scale()).toBe(1);
  });

  it("grows numeric INWARD without scaling the parent", () => {
    const { caret, root, child } = inwardCaret();
    root.setScale(0.7);
    child.setScale(SHRINK_SCALE);
    caret.grow(Direction.INWARD);
    expect(child.scale()).toBe(1);
    expect(root.scale()).toBe(0.7);
  });

  it.each([
    ["fitExact", Fit.EXACT, Fit.LOOSE],
    ["fitLoose", Fit.LOOSE, Fit.EXACT],
    ["fitNaive", Fit.NAIVE, Fit.LOOSE],
  ] as const)("%s targets numeric INWARD", (method, expected, original) => {
    const { caret, root, child } = inwardCaret();
    root.setNodeFit(original);
    child.setNodeFit(original);
    caret[method](Direction.INWARD);
    expect(child.nodeFit()).toBe(expected);
    expect(root.nodeFit()).toBe(original);
  });

  it("aligns the direct child's actual parent edge", () => {
    const caret = new DirectionCaret("root");
    const root = caret.node();
    const child = caret.spawnMove(Direction.FORWARD, "child");
    caret.align("positive");
    expect(root.neighbors().getAlignment(Direction.FORWARD)).toBe(
      Alignment.POSITIVE
    );
    expect(root.nodeFit()).toBe(Fit.EXACT);
    expect(child.nodeFit()).toBe(Fit.LOOSE);
  });

  it("aligns the child edge when its axis differs from the grandparent's", () => {
    const caret = new DirectionCaret("root");
    caret.spawnMove(Direction.FORWARD, "parent");
    const parent = caret.node();
    caret.spawnMove(Direction.DOWNWARD, "child");
    caret.align("negative");
    expect(parent.neighbors().getAlignment(Direction.DOWNWARD)).toBe(
      Alignment.NEGATIVE
    );
    expect(parent.neighbors().at(Direction.FORWARD)).toBeUndefined();
  });

  it("rejects parent alignment of a root", () => {
    const caret = new DirectionCaret();
    expect(() => caret.align("center")).toThrow("Cannot align root");
  });

  it.each(["fit", "align"])(
    "%s invalidates the changed node and its committed ancestors",
    (operation) => {
      const caret = new DirectionCaret("root");
      const root = caret.node();
      const parent = caret.spawnMove(Direction.FORWARD, "parent");
      const child = caret.spawn(Direction.INWARD, "child");
      const nodes: DirectionNode[] = [root, parent, child];
      nodes.forEach((node) => node.layout().setPhase(LayoutPhase.COMMITTED));
      if (operation === "fit") {
        caret.fitExact(Direction.INWARD);
        expect(child.layout().phase()).toBe(LayoutPhase.NEEDS_COMMIT);
      } else {
        caret.move(Direction.INWARD);
        caret.align("vertical");
        expect(parent.neighbors().getAlignment(Direction.INWARD)).toBe(
          Alignment.INWARD_VERTICAL
        );
      }
      expect(parent.layout().phase()).toBe(LayoutPhase.NEEDS_COMMIT);
      expect(root.layout().phase()).toBe(LayoutPhase.NEEDS_COMMIT);
    }
  );
});
