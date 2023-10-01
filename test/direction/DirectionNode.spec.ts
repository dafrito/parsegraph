import { assert } from "chai";
import { Direction } from "../../src/Direction";
import { PreferredAxis, DirectionNode } from "../../src/DirectionNode";
import { findDistance } from "../../src/DirectionNode";

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
    assert.isNotNull(n.layout());
  });

  it("can handle paint group array creasing", () => {
    const root = new DirectionNode<string>().setId("root");

    const arrNode = new DirectionNode<string>().setId("main-array");
    root.connect(Direction.FORWARD, arrNode);
    const beforeBud = new DirectionNode().setId(`before-bud`);
    root.connect(Direction.INWARD, beforeBud);

    let next = root;

    const blocks: DirectionNode<string>[] = [];
    for (let i = 0; i < 2; ++i) {
      const b = new DirectionNode<string>().setId(`block-${i}`);
      blocks.push(b);
      const afterBud = new DirectionNode().setId(`${i}-after-bud`);
      b.connect(Direction.FORWARD, afterBud);
      next.connect(Direction.FORWARD, b);
      next = afterBud;
    }

    const inner = new DirectionNode<string>().setId("last-inward");
    inner.crease();
    blocks[blocks.length - 1].connect(Direction.INWARD, inner);

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "last-inward"]);

    const inner2 = new DirectionNode<string>().setId("next-last-inward");
    inner2.crease();
    blocks[blocks.length - 2].connect(Direction.INWARD, inner2);

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
      node.connect(Direction.INWARD, inner);
      return node;
    };

    let last = root;
    let next = root;
    for (let i = 0; i < 2; ++i) {
      const b = makeBlock(String(i));
      const bud = new DirectionNode().setId(`${i} bud`);
      bud.connect(Direction.FORWARD, b);
      // b.crease();
      next.connect(Direction.DOWNWARD, bud);
      last = next;
      next = bud;
    }

    expect(findDistance(last, next)).toEqual(1);

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
      node.connect(Direction.INWARD, inner);
      return node;
    };

    let last = root;
    let next = root;
    for (let i = 0; i < 4; ++i) {
      const b = makeBlock(String(i));
      const bud = new DirectionNode().setId(`${i} bud`);
      bud.connect(Direction.FORWARD, b);
      // b.crease();
      next.connect(Direction.DOWNWARD, bud);
      last = next;
      next = bud;
    }

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward", "3inward"]);

    expect(next.neighbors().nodeAt(Direction.FORWARD).id()).toEqual("3block");
    next.neighbors().nodeAt(Direction.FORWARD).crease();
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward", "3block", "3inward"]);
    next.disconnect(Direction.FORWARD);
    root.paintGroup().verify();
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward"]);
    const spawned = makeBlock("spawned");
    next.connect(Direction.FORWARD, spawned);
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
    next.disconnect(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward"]);
    next.connect(Direction.FORWARD, spawned);
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
    next.disconnect(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "2inward"]);

    last.disconnect(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward"]);
    const spawned2 = makeBlock("spawned2");
    // spawned2.crease();
    last.connect(Direction.FORWARD, spawned2);

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

    last.disconnect(Direction.FORWARD);

    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward"]);
    spawned2.uncrease();

    last.connect(Direction.FORWARD, spawned2);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "spawned2inward"]);

    const spawned3 = makeBlock("spawned3");
    next.connect(Direction.FORWARD, spawned3);
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
    next.connect(Direction.FORWARD, makeBlock("spawned4"));
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
    last.disconnect(Direction.FORWARD);
    expect(
      root
        .paintGroup()
        .dump()
        .map((pg) => pg.id())
    ).toEqual(["root", "0inward", "1inward", "spawned4inward"]);
    last.connect(Direction.FORWARD, makeBlock("spawned5"));
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
    bud.siblings().setLayoutPreference(PreferredAxis.VERTICAL);
    bud.connect(Direction.FORWARD, new DirectionNode().setId("f"));
    bud.connect(Direction.BACKWARD, new DirectionNode().setId("b"));
    bud.connect(Direction.DOWNWARD, new DirectionNode().setId("d"));
    bud.connect(Direction.UPWARD, new DirectionNode().setId("u"));
    bud.siblings().setLayoutPreference(PreferredAxis.HORIZONTAL);
  });

  it("can be pulled the other way", () => {
    const bud = new DirectionNode().setId("bud");
    bud.siblings().setLayoutPreference(PreferredAxis.HORIZONTAL);
    bud.connect(Direction.FORWARD, new DirectionNode().setId("f"));
    bud.connect(Direction.BACKWARD, new DirectionNode().setId("b"));
    bud.connect(Direction.DOWNWARD, new DirectionNode().setId("d"));
    bud.connect(Direction.UPWARD, new DirectionNode().setId("u"));
    bud.siblings().setLayoutPreference(PreferredAxis.VERTICAL);
  });
});
