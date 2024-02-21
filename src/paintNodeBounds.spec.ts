import { assert } from "chai";
import { 
    CommitLayout,
    DirectionNode,
    paintNodeBounds,
} from ".";

describe("serializeParsegraph", () => {
it("works", () => {
    // TODO Build a graph.
    const rootNode = new DirectionNode("Hello, world");
    
    const layout = new CommitLayout(rootNode, {
    size: (node: DirectionNode, size: number[]) => {
        // TODO Provide the size of the node to the size object.
        // This will be called for every DirectionNode.
        size[0] = 24;
        size[1] = 80;
    }
    });
    
    // Commit the layout.
    while (layout.crank());
    
    // Render the graph.
    rootNode.paintGroup().forEach((pg: DirectionNode) => {
    pg.siblings().forEach(node => {
        paintNodeBounds(node, (x, y, w, h) => {
            assert.equal(0, x);
            assert.equal(0, y);
            assert.equal(24, w);
            assert.equal(80, h);
        });
    });
    });
  });
});
