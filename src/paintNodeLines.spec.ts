import { 
    CommitLayout,
    Direction,
    DirectionNode,
    paintNodeBounds,
    paintNodeLines,
} from ".";

describe("serializeParsegraph", () => {
it("works", () => {
    // TODO Build a graph.
    const rootNode = new DirectionNode("Hello, world");
    rootNode.connect(Direction.FORWARD, new DirectionNode("Child"));

    const width = 24;
    const height = 80;
    const separation = 10;
    
    const layout = new CommitLayout(rootNode, {
    size: (node: DirectionNode, size: number[]) => {
        // TODO Provide the size of the node to the size object.
        // This will be called for every DirectionNode.
        size[0] = width;
        size[1] = height;
    },
    getSeparation: () => separation
    });
    
    // Commit the layout.
    while (layout.crank());

    const painter = jest.fn();
    const linePainter = jest.fn();

    const lineThickness = 5;
    
    // Render the graph.
    rootNode.paintGroup().forEach((pg: DirectionNode) => {
    pg.siblings().forEach(node => {
        paintNodeLines(node, lineThickness, linePainter);
        paintNodeBounds(node, painter);
    });
    });

    expect(painter).toHaveBeenCalledTimes(2);
    expect(painter).toHaveBeenNthCalledWith(1, 0, 0, width, height);
    expect(painter).toHaveBeenNthCalledWith(2, width + separation, 0, width, height);

    expect(linePainter).toHaveBeenCalledTimes(1);
    expect(linePainter).toHaveBeenCalledWith(width / 2 + separation / 2, 0, separation, lineThickness)
  });
  it("throws if no thickness", () => {
    expect(() => (paintNodeLines as any)(new DirectionNode(), () => {})).toThrow();
  });
});
