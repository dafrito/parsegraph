import { assert } from "chai";
import Direction, { PreferredAxis, DirectionNode } from "../../src/direction";

describe("DirectionNode", function () {
  it("can be constructed without a Type param", () => {
    new DirectionNode();
  });

  it("can be constructed with a string param", () => {
    const n = new DirectionNode<string>();
    assert.equal(null, n.value());
    n.setValue("Hey");
    assert.equal("Hey", n.value());
  });

  it("can be constructed with a layout", () => {
    const n = new DirectionNode<string>();
    assert.isNotNull(n.getLayout());
  });

  it("can handle paint group array creasing", () => {
    const root = new DirectionNode<string>().setId("root");

    const arrNode = new DirectionNode<string>().setId("main-array");
    root.connectNode(Direction.FORWARD, arrNode);
    const beforeBud = new DirectionNode().setId(`before-bud`);
    root.connectNode(Direction.INWARD, beforeBud);

    let last = root;
    let next = root;

    const blocks = [];
    for (let i = 0; i < 2; ++i) {
      const b = new DirectionNode<string>().setId(`block-${i}`);
      blocks.push(b);
      const afterBud = new DirectionNode().setId(`${i}-after-bud`);
      b.connectNode(Direction.FORWARD, afterBud);
      next.connectNode(Direction.FORWARD, b);
      last = next;
      next = afterBud;
    }

    const inner = new DirectionNode<string>().setId("last-inward");
    inner.crease();
    blocks[blocks.length - 1].connectNode(Direction.INWARD, inner);

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "last-inward"]);

    const inner2 = new DirectionNode<string>().setId("next-last-inward");
    inner2.crease();
    blocks[blocks.length - 2].connectNode(Direction.INWARD, inner2);

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "next-last-inward", "last-inward"]);
  });

  it("can handle paint group creasing, simple", () => {
    const root = new DirectionNode<string>().setId("root");

    const makeBlock = (name: string) => {
      const node = new DirectionNode<string>().setId(name + "block");
      const inner = new DirectionNode<string>().setId(name + "inward");
      inner.crease();
      node.connectNode(Direction.INWARD, inner);
      return node;
    };

    let last = root;
    let next = root;
    for (let i = 0; i < 2; ++i) {
      const b = makeBlock(String(i));
      const bud = new DirectionNode().setId(`${i} bud`);
      bud.connectNode(Direction.FORWARD, b);
      // b.crease();
      next.connectNode(Direction.DOWNWARD, bud);
      last = next;
      next = bud;
    }

    expect(last.findDistance(next)).toEqual(1);

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward"]);
  });

  it("can handle paint group creasing", () => {
    const root = new DirectionNode<string>().setId("root");

    const makeBlock = (name: string) => {
      const node = new DirectionNode<string>().setId(name + "block");
      const inner = new DirectionNode<string>().setId(name + "inward");
      inner.crease();
      node.connectNode(Direction.INWARD, inner);
      return node;
    };

    let last = root;
    let next = root;
    for (let i = 0; i < 4; ++i) {
      const b = makeBlock(String(i));
      const bud = new DirectionNode().setId(`${i} bud`);
      bud.connectNode(Direction.FORWARD, b);
      // b.crease();
      next.connectNode(Direction.DOWNWARD, bud);
      last = next;
      next = bud;
    }

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward", "3inward"]);

    expect(next.nodeAt(Direction.FORWARD).id()).toEqual("3block");
    next.nodeAt(Direction.FORWARD).crease();
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward", "3block", "3inward"]);
    next.disconnectNode(Direction.FORWARD);
    root.paintGroup().verify();
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward"]);
    const spawned = makeBlock("spawned");
    next.connectNode(Direction.FORWARD, spawned);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward", "spawnedinward"]);
    spawned.crease();
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual([
      "root",
      "0inward",
      "1inward",
      "2inward",
      "spawnedblock",
      "spawnedinward",
    ]);
    next.disconnectNode(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward"]);
    next.connectNode(Direction.FORWARD, spawned);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual([
      "root",
      "0inward",
      "1inward",
      "2inward",
      "spawnedblock",
      "spawnedinward",
    ]);
    spawned.uncrease();
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward", "spawnedinward"]);
    next.disconnectNode(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward"]);

    last.disconnectNode(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward"]);
    const spawned2 = makeBlock("spawned2");
    // spawned2.crease();
    last.connectNode(Direction.FORWARD, spawned2);

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "spawned2inward"]);

    spawned2.crease();

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual([
      "root",
      "0inward",
      "1inward",
      "spawned2block",
      "spawned2inward",
    ]);

    last.disconnectNode(Direction.FORWARD);

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward"]);
    spawned2.uncrease();

    last.connectNode(Direction.FORWARD, spawned2);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "spawned2inward"]);

    const spawned3 = makeBlock("spawned3");
    next.connectNode(Direction.FORWARD, spawned3);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual([
      "root",
      "0inward",
      "1inward",
      "spawned2inward",
      "spawned3inward",
    ]);
    next.connectNode(Direction.FORWARD, makeBlock("spawned4"));
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual([
      "root",
      "0inward",
      "1inward",
      "spawned2inward",
      "spawned4inward",
    ]);
    last.disconnectNode(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "spawned4inward"]);
    last.connectNode(Direction.FORWARD, makeBlock("spawned5"));
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual([
      "root",
      "0inward",
      "1inward",
      "spawned5inward",
      "spawned4inward",
    ]);
  });

  it("can be pulled", () => {
    const bud = new DirectionNode().setId("bud");
    bud.setLayoutPreference(PreferredAxis.VERTICAL);
    bud.connectNode(Direction.FORWARD, new DirectionNode().setId("f"));
    bud.connectNode(Direction.BACKWARD, new DirectionNode().setId("b"));
    bud.connectNode(Direction.DOWNWARD, new DirectionNode().setId("d"));
    bud.connectNode(Direction.UPWARD, new DirectionNode().setId("u"));
    bud.setLayoutPreference(PreferredAxis.HORIZONTAL);
  });

  it("can be pulled the other way", () => {
    const bud = new DirectionNode().setId("bud");
    bud.setLayoutPreference(PreferredAxis.HORIZONTAL);
    bud.connectNode(Direction.FORWARD, new DirectionNode().setId("f"));
    bud.connectNode(Direction.BACKWARD, new DirectionNode().setId("b"));
    bud.connectNode(Direction.DOWNWARD, new DirectionNode().setId("d"));
    bud.connectNode(Direction.UPWARD, new DirectionNode().setId("u"));
    bud.setLayoutPreference(PreferredAxis.VERTICAL);
  });
});
