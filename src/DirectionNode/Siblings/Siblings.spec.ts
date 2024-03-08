import { assert } from "chai";
import { CommitLayout, Direction, DirectionNode, PreferredAxis } from "../..";

describe("Siblings", () => {
  it("keeps non-root PreferredAxis when connecting or disconnecting", () => {
    const n = new DirectionNode();
    n.siblings().pull(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);

    const root = new DirectionNode();
    root.connect(Direction.DOWNWARD, n);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);

    root.disconnect(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);
  });

  it("unreachable test", () => {
    const root = new DirectionNode();
    const inward = new DirectionNode();
    root.connect(Direction.INWARD, inward);
    inward.siblings().setLayoutPreference(PreferredAxis.PARENT);
  });

  it("pull test", () => {
    const nodes: DirectionNode[] = [];
    for (let i = 0; i < 5; ++i) {
      nodes.push(new DirectionNode(i));
    }

    const root = nodes[0];
    nodes[0].setValue("Why diagram");
    nodes[0].connect(4, nodes[1]);
    nodes[1].connect(4, nodes[2]);
    nodes[1].connect(2, nodes[3]);
    nodes[3].connect(4, nodes[4]);

    nodes[0].siblings().setLayoutPreference(3);
    nodes[1].siblings().setLayoutPreference(2);
    nodes[2].siblings().setLayoutPreference(2);
    nodes[3].siblings().setLayoutPreference(2);
    nodes[4].siblings().setLayoutPreference(2);

    const cld = new CommitLayout(root, {
      size: (node: DirectionNode, size: number[]) => {
        // TODO Provide the size of the node to the size object.
        // This will be called for every DirectionNode.
        size[0] = 24;
        size[1] = 80;
      },
      getSeparation: () => {
        // TODO return the minimum separation between two DirectionNodes.
        // The same value can be called for every neighbor.
        return 0;
      },
      paint: (): boolean => {
        // TODO pre-render content as necessary
        // This is optional.
        return false;
      },
    });

    // Paint the graph; build the scene.
    while (cld.crank());

    root
      .neighbors()
      .nodeAt(Direction.FORWARD)
      .siblings()
      .pull(Direction.FORWARD);

    cld.reset(root);
    while (cld.crank());
  });

  it("converts a non-root PreferredAxis to a root PreferredAxis", () => {
    const n = new DirectionNode();
    n.siblings().pull(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);

    const root = new DirectionNode();
    root.connect(Direction.DOWNWARD, n);

    n.siblings().pull(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.PARENT);

    root.disconnect(Direction.DOWNWARD);

    assert.equal(n.siblings().getLayoutPreference(), PreferredAxis.VERTICAL);
  });
});
