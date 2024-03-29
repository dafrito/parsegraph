import assert from "assert";
import { DirectionNode } from "../..";

import {
  DirectionCaret,
  Direction,
  Axis,
  getPositiveDirection,
  paintNodeBounds,
  turnRight,
} from "../../..";

import { CommitLayout } from "./CommitLayout";

interface Metrics {
  paintGroupRenders: number;
  paints: number;
  sizes: number;
  seps: number;
  layouts: number;
  renders: number;
}

interface Metrics2 extends Metrics {
  paintedNodes: number;
}

const demo = (rootNode: DirectionNode): Metrics => {
  const m: Metrics = {
    paints: 0,
    sizes: 0,
    seps: 0,
    layouts: 0,
    renders: 0,
    paintGroupRenders: 0,
  };
  const cld = new CommitLayout(rootNode, {
    size: (node: DirectionNode, size: number[]) => {
      // TODO Provide the size of the node to the size object.
      // This will be called for every DirectionNode.
      size[0] = 24;
      size[1] = 80;
      ++m.sizes;
    },
    getSeparation: () => {
      // TODO return the minimum separation between two DirectionNodes.
      // The same value can be called for every neighbor.
      ++m.seps;
      return 0;
    },
    paint: (): boolean => {
      // TODO pre-render content as necessary
      // This is optional.
      ++m.paints;
      return false;
    },
  });

  // Paint the graph; build the scene.
  while (cld.crank()) {
    ++m.layouts;
  }

  // Render the graph.
  rootNode.paintGroup().forEach((pg: DirectionNode) => {
    ++m.paintGroupRenders;
    pg.siblings().forEach((node) => {
      paintNodeBounds(node, () => {
        // Draw the node.
        ++m.renders;
      });
    });
  });

  return m;
};

const demo2 = (rootNode: DirectionNode): Metrics2 => {
  const m: Metrics2 = {
    paints: 0,
    sizes: 0,
    seps: 0,
    layouts: 0,
    renders: 0,
    paintedNodes: 0,
    paintGroupRenders: 0,
  };
  const cld = new CommitLayout(rootNode, {
    size: (node: DirectionNode, size: number[]) => {
      // TODO Provide the size of the node to the size object.
      // This will be called for every DirectionNode.
      size[0] = 24;
      size[1] = 80;
      ++m.sizes;
    },
    getSeparation: () => {
      // TODO return the minimum separation between two DirectionNodes.
      // The same value can be called for every neighbor.
      ++m.seps;
      return 0;
    },
    paint: (pg: DirectionNode): boolean => {
      // TODO pre-render content as necessary
      // This is optional.
      ++m.paints;
      pg.siblings().forEach(() => {
        ++m.paintedNodes;
      });
      return false;
    },
  });

  // Paint the graph; build the scene.
  while (cld.crank()) {
    ++m.layouts;
  }

  // Render the graph.
  rootNode.paintGroup().forEach((pg: DirectionNode) => {
    ++m.paintGroupRenders;
    pg.siblings().forEach((node) => {
      paintNodeBounds(node, () => {
        // Draw the node.
        ++m.renders;
      });
    });
  });

  return m;
};

const demoMultiple = (rootNode: DirectionNode): (() => Metrics) => {
  const m: Metrics = {
    paints: 0,
    sizes: 0,
    seps: 0,
    layouts: 0,
    renders: 0,
    paintGroupRenders: 0,
  };
  const cld = new CommitLayout(rootNode, {
    size: (node: DirectionNode, size: number[]) => {
      // TODO Provide the size of the node to the size object.
      // This will be called for every DirectionNode.
      size[0] = 24;
      size[1] = 80;
      ++m.sizes;
    },
    getSeparation: () => {
      // TODO return the minimum separation between two DirectionNodes.
      // The same value can be called for every neighbor.
      ++m.seps;
      return 0;
    },
    paint: (): boolean => {
      // TODO pre-render content as necessary
      // This is optional.
      ++m.paints;
      return false;
    },
  });

  return () => {
    m.paints = 0;
    m.sizes = 0;
    m.seps = 0;
    m.layouts = 0;
    m.renders = 0;
    m.paintGroupRenders = 0;

    // Paint the graph; build the scene.
    while (cld.crank()) {
      ++m.layouts;
    }

    // Render the graph.
    rootNode.paintGroup().forEach((pg: DirectionNode) => {
      ++m.paintGroupRenders;
      pg.siblings().forEach((node) => {
        paintNodeBounds(node, () => {
          // Draw the node.
          ++m.renders;
        });
      });
    });

    return m;
  };
};

describe("CommitLayout", () => {
  it("single node ", () => {
    const buildGraph = () => {
      // TODO Build a graph.
      return new DirectionNode("Hello, world");
    };

    const rootNode = buildGraph();

    let paintCount = 0;
    let sizeCount = 0;
    let sepCount = 0;
    const cld = new CommitLayout(rootNode, {
      size: (node: DirectionNode, size: number[]) => {
        // TODO Provide the size of the node to the size object.
        // This will be called for every DirectionNode.
        size[0] = 24;
        size[1] = 80;
        ++sizeCount;
      },
      getSeparation: () => {
        // TODO return the minimum separation between two DirectionNodes.
        // The same value can be called for every neighbor.
        ++sepCount;
        return 0;
      },
      paint: (): boolean => {
        // TODO pre-render content as necessary
        // This is optional.
        ++paintCount;
        return false;
      },
    });

    // Paint the graph; build the scene.
    let layoutCounts = 0;
    while (cld.crank()) {
      ++layoutCounts;
    }

    // Render the graph.
    let renderCounts = 0;
    rootNode.paintGroup().forEach((pg: DirectionNode) => {
      pg.siblings().forEach((node) => {
        paintNodeBounds(node, () => {
          // Draw the node.
          ++renderCounts;
        });
      });
    });

    assert.equal(renderCounts, 1);
    assert.equal(layoutCounts, 1);
    assert.equal(paintCount, 1);
    assert.equal(sepCount, 0);
    assert.equal(sizeCount, 1);
  });

  it("one neighbor", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      car.spawnMove("f", "neighbor");
      return car.root();
    };

    const rootNode = buildGraph();

    let paintCount = 0;
    let sizeCount = 0;
    let sepCount = 0;
    const cld = new CommitLayout(rootNode, {
      size: (node: DirectionNode, size: number[]) => {
        // TODO Provide the size of the node to the size object.
        // This will be called for every DirectionNode.
        size[0] = 24;
        size[1] = 80;
        ++sizeCount;
      },
      getSeparation: () => {
        // TODO return the minimum separation between two DirectionNodes.
        // The same value can be called for every neighbor.
        ++sepCount;
        return 0;
      },
      paint: (): boolean => {
        // TODO pre-render content as necessary
        // This is optional.
        ++paintCount;
        return false;
      },
    });

    // Paint the graph; build the scene.
    let layoutCounts = 0;
    while (cld.crank()) {
      ++layoutCounts;
    }

    // Render the graph.
    let renderCounts = 0;
    rootNode.paintGroup().forEach((pg: DirectionNode) => {
      pg.siblings().forEach((node) => {
        paintNodeBounds(node, () => {
          // Draw the node.
          ++renderCounts;
        });
      });
    });

    assert.equal(sizeCount, 2);
    assert.equal(sepCount, 1);
    assert.equal(paintCount, 1);

    assert.equal(layoutCounts, 2);
    assert.equal(renderCounts, 2);
  });

  it("two neighbors", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      car.spawn("f", "front neighbor");
      car.spawn("b", "back neighbor");
      return car.root();
    };

    const rootNode = buildGraph();

    let paintCount = 0;
    let sizeCount = 0;
    let sepCount = 0;
    const cld = new CommitLayout(rootNode, {
      size: (node: DirectionNode, size: number[]) => {
        // TODO Provide the size of the node to the size object.
        // This will be called for every DirectionNode.
        size[0] = 24;
        size[1] = 80;
        ++sizeCount;
      },
      getSeparation: () => {
        // TODO return the minimum separation between two DirectionNodes.
        // The same value can be called for every neighbor.
        ++sepCount;
        return 0;
      },
      paint: (): boolean => {
        // TODO pre-render content as necessary
        // This is optional.
        ++paintCount;
        return false;
      },
    });

    // Paint the graph; build the scene.
    let layoutCounts = 0;
    while (cld.crank()) {
      ++layoutCounts;
    }

    // Render the graph.
    let renderCounts = 0;
    rootNode.paintGroup().forEach((pg: DirectionNode) => {
      pg.siblings().forEach((node) => {
        paintNodeBounds(node, () => {
          // Draw the node.
          ++renderCounts;
        });
      });
    });

    assert.equal(sizeCount, 3);
    assert.equal(sepCount, 2);
    assert.equal(paintCount, 1);

    assert.equal(layoutCounts, 3);
    assert.equal(renderCounts, 3);
  });

  it("single node", () => {
    const buildGraph = () => {
      const car = new DirectionCaret();
      return car.root();
    };

    assert.deepEqual(demo(buildGraph()), {
      sizes: 1,
      seps: 0,
      paints: 1,
      layouts: 1,
      renders: 1,
      paintGroupRenders: 1,
    });
  });

  it("three neighbors", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      car.spawn("f", "front neighbor");
      car.spawn("b", "back neighbor");
      car.spawn("d", "neighbor down under");
      return car.root();
    };

    assert.deepEqual(demo(buildGraph()), {
      sizes: 4,
      seps: 3,
      paints: 1,
      layouts: 4,
      renders: 4,
      paintGroupRenders: 1,
    });
  });

  it("four neighbors", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      car.spawn("f", "front neighbor");
      car.spawn("b", "back neighbor");
      car.spawn("d", "neighbor down under");
      car.spawn("u", "neighbor down under");
      return car.root();
    };

    assert.deepEqual(demo(buildGraph()), {
      sizes: 5,
      seps: 4,
      paints: 1,
      layouts: 5,
      renders: 5,
      paintGroupRenders: 1,
    });
  });

  it("five neighbors", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      car.spawn("f", "front neighbor");
      car.spawn("b", "back neighbor");
      car.spawn("d", "neighbor down under");
      car.spawn("u", "neighbor down under");
      car.spawn("i", "inner neighbor");
      return car.root();
    };

    assert.deepEqual(demo(buildGraph()), {
      sizes: 6,
      seps: 5,
      paints: 1,
      layouts: 6,
      renders: 6,
      paintGroupRenders: 1,
    });
  });

  it("ten inner neighbors", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      for (let i = 0; i < 10; ++i) {
        car.spawnMove("i", "inner neighbor " + (1 + i));
      }
      return car.root();
    };

    assert.deepEqual(demo(buildGraph()), {
      sizes: 11,
      seps: 10,
      paints: 1,
      layouts: 11,
      renders: 11,
      paintGroupRenders: 1,
    });
  });

  it("ten forward neighbors", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      for (let i = 0; i < 10; ++i) {
        car.spawnMove("f", "forward neighbor " + (1 + i));
      }
      return car.root();
    };

    assert.deepEqual(demo(buildGraph()), {
      sizes: 11,
      seps: 10,
      paints: 1,
      layouts: 11,
      renders: 11,
      paintGroupRenders: 1,
    });
  });

  it("ten downward neighbors", () => {
    const buildGraph = () => {
      const car = new DirectionCaret("root");
      for (let i = 0; i < 10; ++i) {
        car.spawnMove("d", "downward neighbor " + (1 + i));
      }
      return car.root();
    };

    assert.deepEqual(demo(buildGraph()), {
      sizes: 11,
      seps: 10,
      paints: 1,
      layouts: 11,
      renders: 11,
      paintGroupRenders: 1,
    });
  });

  it("ten neighbors any positive cardinal direction", () => {
    const buildGraph = (dir: string) => {
      const car = new DirectionCaret("root");
      for (let i = 0; i < 10; ++i) {
        car.spawnMove(dir, "downward neighbor " + (1 + i));
      }
      return car.root();
    };

    assert.deepEqual(demo(buildGraph("f")), {
      sizes: 11,
      seps: 10,
      paints: 1,
      layouts: 11,
      renders: 11,
      paintGroupRenders: 1,
    });
    assert.deepEqual(demo(buildGraph("d")), {
      sizes: 11,
      seps: 10,
      paints: 1,
      layouts: 11,
      renders: 11,
      paintGroupRenders: 1,
    });
    assert.equal(getPositiveDirection(Axis.HORIZONTAL), Direction.FORWARD);
  });

  it("ten neighbors any negative cardinal direction", () => {
    const buildGraph = (dir: string) => {
      const car = new DirectionCaret("root");
      for (let i = 0; i < 10; ++i) {
        car.spawnMove(dir, "downward neighbor " + (1 + i));
      }
      return car.root();
    };

    assert.deepEqual(demo(buildGraph("b")), {
      sizes: 11,
      seps: 10,
      paints: 1,
      layouts: 11,
      renders: 11,
      paintGroupRenders: 1,
    });
    assert.deepEqual(demo(buildGraph("u")), {
      sizes: 11,
      seps: 10,
      paints: 1,
      layouts: 11,
      paintGroupRenders: 1,
      renders: 11,
    });
    assert.equal(getPositiveDirection(Axis.HORIZONTAL), Direction.FORWARD);
  });

  it("ten forward neighbors iterated each node", () => {
    const car = new DirectionCaret();
    const layout = demoMultiple(car.root());
    layout();
    assert.deepEqual(layout(), {
      sizes: 0,
      seps: 0,
      paints: 0,
      layouts: 0,
      renders: 1,
      paintGroupRenders: 1,
    });
    for (let i = 0; i < 10; ++i) {
      car.spawnMove("f", i);
      assert.deepEqual(
        { i, ...layout() },
        {
          i,
          sizes: 2 + i,
          seps: 1 + i,
          paints: 1,
          layouts: 2 + i,
          renders: 2 + i,
          paintGroupRenders: 1,
        }
      );
    }
  });

  it("ten backward neighbors iterated each node", () => {
    const car = new DirectionCaret();
    const layout = demoMultiple(car.root());
    layout();
    assert.deepEqual(layout(), {
      sizes: 0,
      seps: 0,
      paints: 0,
      layouts: 0,
      renders: 1,
      paintGroupRenders: 1,
    });
    for (let i = 0; i < 10; ++i) {
      car.spawnMove("b", i);
      assert.deepEqual(
        { i, ...layout() },
        {
          i,
          sizes: 2 + i,
          seps: 1 + i,
          paints: 1,
          layouts: 2 + i,
          renders: 2 + i,
          paintGroupRenders: 1,
        }
      );
    }
  });

  it("does not repaint each frame", () => {
    const car = new DirectionCaret();
    const layout = demoMultiple(car.root());
    let paints = 0;
    let renders = 0;
    for (let i = 0; i < 10; ++i) {
      const m = layout();
      paints += m.paints;
      renders += m.renders;
    }
    assert.deepEqual(paints, 1);
    assert.deepEqual(renders, 10);
  });

  it("lays out whole graphs using paintgroups", () => {
    let root = new DirectionNode();
    demo2(root);
    let paintedNodes = 0;
    let paints = 0;
    let renders = 0;
    for (let i = 0; i < 10; ++i) {
      root.paintGroups().crease();
      const newRoot = new DirectionNode();
      root.connect(Direction.BACKWARD, newRoot);
      root = newRoot;
      const m = demo2(root.neighbors().root());
      paintedNodes += m.paintedNodes;
      paints += m.paints;
      renders += m.renders;
    }
    assert.deepEqual(paints, 55);
    assert.deepEqual(renders, 65);
    assert.deepEqual(paintedNodes, 65);
  });

  it("lays out whole graphs at once in a single paintgroup", () => {
    let root = new DirectionNode();
    demo(root);
    let paints = 0;
    let renders = 0;
    for (let i = 0; i < 10; ++i) {
      const newRoot = new DirectionNode();
      root.connect(Direction.BACKWARD, newRoot);
      root = newRoot;
      const m = demo(root.neighbors().root());
      paints += m.paints;
      renders += m.renders;
    }
    assert.deepEqual(paints, 10);
    assert.deepEqual(renders, 65);
  });

  it("lays out paint groups", () => {
    let root = new DirectionNode();
    demo(root);
    let paints = 0;
    let renders = 0;
    for (let i = 0; i < 10; ++i) {
      root.paintGroups().crease();
      const newRoot = new DirectionNode();
      newRoot.connect(Direction.BACKWARD, root);
      root = newRoot;
      const m = demo(root);
      paints += m.paints;
      renders += m.renders;
    }
    assert.deepEqual(paints, 10);
    assert.deepEqual(renders, 65);
  });

  it("can build backwards", () => {
    let root = new DirectionNode();
    demo(root);
    let paints = 0;
    let renders = 0;
    let paintedNodes = 0;
    for (let i = 0; i < 10; ++i) {
      const newRoot = new DirectionNode();
      newRoot.connect(Direction.BACKWARD, root);
      root = newRoot;
      const m = demo2(root);
      paints += m.paints;
      renders += m.renders;
      paintedNodes += m.paintedNodes;
    }
    assert.deepEqual(paints, 10);
    assert.deepEqual(renders, 65);
    assert.deepEqual(paintedNodes, 65);
  });

  it("can build backwards with paint group", () => {
    let root = new DirectionNode();
    demo(root);
    let paints = 0;
    let renders = 0;
    let paintedNodes = 0;
    for (let i = 0; i < 10; ++i) {
      root.paintGroups().crease();
      const newRoot = new DirectionNode();
      newRoot.connect(Direction.BACKWARD, root);
      root = newRoot;
      const m = demo2(root);
      paints += m.paints;
      renders += m.renders;
      paintedNodes += m.paintedNodes;
    }
    assert.deepEqual(paints, 10);
    assert.deepEqual(renders, 65);
    assert.deepEqual(paintedNodes, 10);
  });

  it("ten creased forward neighbors iterated each node", () => {
    const car = new DirectionCaret();
    const layout = demoMultiple(car.root());
    layout();
    assert.deepEqual(layout(), {
      paintGroupRenders: 1,
      sizes: 0,
      seps: 0,
      paints: 0,
      layouts: 0,
      renders: 1,
    });
    for (let i = 0; i < 10; ++i) {
      car.spawnMove("f", i);
      car.crease();
      assert.deepEqual(
        { i, ...layout() },
        {
          i,
          sizes: 2 + i,
          seps: 1 + i,
          paints: 2 + i,
          layouts: 5 + 4 * i,
          renders: 2 + i,
          paintGroupRenders: 2 + i,
        }
      );
    }
  });

  it("ten node turn-right spiral iterated each node", () => {
    const car = new DirectionCaret();
    const layout = demoMultiple(car.root());
    layout();
    assert.deepEqual(layout(), {
      paintGroupRenders: 1,
      sizes: 0,
      seps: 0,
      paints: 0,
      layouts: 0,
      renders: 1,
    });
    let dir: Direction = Direction.FORWARD;
    for (let i = 0; i < 10; ++i) {
      car.spawnMove(dir, i);
      dir = turnRight(dir);
      car.crease();
      assert.deepEqual(
        { i, ...layout() },
        {
          i,
          sizes: 2 + i,
          seps: 1 + i,
          paints: 2 + i,
          layouts: 5 + 4 * i,
          renders: 2 + i,
          paintGroupRenders: 2 + i,
        }
      );
    }
  });

  it("100 node turn-right spiral printed metrics", () => {
    const car = new DirectionCaret();
    const layout = demoMultiple(car.root());
    layout();
    assert.deepEqual(layout(), {
      sizes: 0,
      seps: 0,
      paints: 0,
      layouts: 0,
      renders: 1,
      paintGroupRenders: 1,
    });
    let dir: Direction = Direction.FORWARD;
    let str = "";
    for (let i = 0; i < 100; ++i) {
      car.spawnMove(dir, i);
      dir = turnRight(dir);
      car.crease();

      const m = layout();
      if (i === 0) {
        str +=
          '"run"\t' +
          Object.keys(m)
            .sort()
            .map((key) => `"${key}"`)
            .join("\t");
        str += "\n";
      } else {
        str +=
          i +
          "\t" +
          Object.keys(m)
            .sort()
            .map((key) => (m as any)[key] / i)
            .join("\t");
        str += "\n";
      }
    }
    expect(str).not.toHaveLength(0);
    // console.log(str);
  });

  it("ideal optimization", () => {
    const testGraph = (crease: boolean) => {
      const car = new DirectionCaret("root");
      car.push();
      car.spawnMove("f", "column cell 1");
      crease && car.crease();
      for (let i = 1; i < 100; ++i) {
        car.spawnMove("f", `column cell ${1 + i}`);
      }
      car.pop();

      demo2(car.root());
      car.spawn("u", "b");

      return demo2(car.root());
    };

    assert.deepEqual(testGraph(false), {
      paintedNodes: 102,
      paintGroupRenders: 1,
      paints: 1,
      sizes: 2,
      seps: 2,
      layouts: 2,
      renders: 102,
    });

    assert.deepEqual(testGraph(true), {
      paintedNodes: 2,
      paintGroupRenders: 2,
      paints: 1,
      sizes: 2,
      seps: 2,
      layouts: 5,
      renders: 102,
    });
  });

  it("draws multiple paint groups", () => {
    const buildGraph = () => {
      // TODO Build a graph.
      return new DirectionNode("Hello, world");
    };

    const rootNode = buildGraph();

    const cld = new CommitLayout(rootNode, {
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
    let layoutCounts = 0;
    while (cld.crank()) {
      ++layoutCounts;
    }

    // Render the graph.
    let renderCounts = 0;
    rootNode.paintGroup().forEach((pg: DirectionNode) => {
      pg.siblings().forEach((node) => {
        paintNodeBounds(node, () => {
          // Draw the node.
          ++renderCounts;
        });
      });
    });

    assert.equal(renderCounts, 1);
    assert.equal(layoutCounts, 1);
  });

  it("is recoverable if replaced", () => {
    const root = new DirectionNode("root");
    let n = root;
    for (let i = 0; i < 100; ++i) {
      const child = new DirectionNode("child");
      n.connect(Direction.FORWARD, child);
      n = child;
    }
    const painter = {
      size: (_: DirectionNode, size: number[]) => {
        size[0] = 100;
        size[1] = 100;
      },
      getSeparation: () => {
        return 0;
      },
    };
    const firstCld = new CommitLayout(root, painter);
    for (let i = 0; i < 50; ++i) {
      firstCld.crank();
    }
    expect(root.layout().needsCommit()).toEqual(true);
    const secondCld = new CommitLayout(root, painter);
    while (secondCld.crank());
    expect(root.layout().needsCommit()).toEqual(false);
  });

  it("does not add unexpected new size", () => {
    const car = new DirectionCaret("root");

    const doLayout = () => {
      const painter = {
        size: (_: DirectionNode, size: number[]) => {
          size[0] = 24;
          size[1] = 24;
        },
        getSeparation: () => {
          return 24;
        },
        lineThickness: () => {
          return 3;
        },
      };
      const cld = new CommitLayout(car.root(), painter);
      while (cld.crank());
      expect(car.root().layout().needsCommit()).toEqual(false);
      const extentSize = [NaN, NaN];
      car.root().layout().extentSize(extentSize);
      return extentSize;
    };

    car.push();
    car.spawnMove("d");
    doLayout();
    car.spawn("b");
    doLayout();
    car.spawn("f");
    doLayout();
    car.pop();

    car.push();
    car.spawnMove("u");
    doLayout();
    car.spawn("b");
    doLayout();
    car.spawn("f");
    doLayout();
    car.pop();

    const extentSize = doLayout();

    car.push();
    car.move("d");
    doLayout();
    car.move("f");
    doLayout();
    car.spawnMove("u");
    car.pop();

    const newExtentSize = doLayout();
    car.root().layout().extentSize(newExtentSize);

    expect(newExtentSize[0]).toEqual(extentSize[0]);
    expect(newExtentSize[1]).toBeGreaterThan(extentSize[1]);

    car.push();
    car.move("u");
    doLayout();
    car.move("f");
    doLayout();
    car.spawnMove("d");
    car.pop();

    const newerExtentSize = doLayout();
    car.root().layout().extentSize(newerExtentSize);

    expect(newerExtentSize[0]).toEqual(extentSize[0]);
    expect(newerExtentSize[1]).toBeGreaterThan(newExtentSize[1]);
  });
});
