import { Fit, CommitLayout, Direction, DirectionNode } from "../.."

describe("Layout", () => {

  it("nodeUnderCoords", () => {
    const root = new DirectionNode("root");
    root.setNodeFit(Fit.EXACT);
    let current = root;
    let nodes = [root];
    for(let i = 0; i < 2; ++i) {
      const n = new DirectionNode("" + i);
      n.setNodeFit(Fit.EXACT);
      nodes.push(n);
      current.connect(Direction.FORWARD, n);
      current = n;
    }

    const layout = new CommitLayout(root, {
      size:(_: DirectionNode, bodySize: number[]) => {
        bodySize[0] = 2;
        bodySize[1] = 2;
      },
      getSeparation: () => 1
    });
    while (layout.crank());

    for (let x = -1; x <= 1; ++x) {
      expect(root.layout().nodeUnderCoords(x, 0, 1.0)?.value()).toEqual(nodes[0].value());
    }
    for (let x = 2; x <= 4; ++x) {
      expect(root.layout().nodeUnderCoords(x, 0, 1.0)?.value()).toEqual(nodes[1].value());
    }
    for (let x = 5; x <= 7; ++x) {
      expect(root.layout().nodeUnderCoords(x, 0, 1.0)?.value()).toEqual(nodes[2].value());
    }

    // []-[]-[]
    expect(root.layout().nodeUnderCoords(8, 0, 1.0)?.value()).toEqual(undefined);
  })

  it("absolute pos is set on commit", () => {
    const root = new DirectionNode("root");
    let current = root;
    let nodes = [root];
    for(let i = 0; i < 2; ++i) {
      const n = new DirectionNode("" + i);
      nodes.push(n);
      current.connect(Direction.FORWARD, n);
      current = n;
    }

    const layout = new CommitLayout(root, {
      size:(_: DirectionNode, bodySize: number[]) => {
        bodySize[0] = 2;
        bodySize[1] = 2;
      },
      getSeparation: () => 1
    });
    while (layout.crank());

    root.paintGroup().forEach(pg => {
      pg.siblings().forEachNode(n => {
        expect(n.layout().needsAbsolutePos()).toBe(false);
      })
    })
  })
})