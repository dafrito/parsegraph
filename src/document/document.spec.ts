import { readFileSync } from "fs";
import { resolve } from "path";
import {
  DirectionCaret,
  DirectionNode,
  Direction,
  Axis,
  AxisOverlap,
  Alignment,
  CommitLayout,
  serializeParsegraph,
  deserializeParsegraph,
  serializeParsegraphDocument,
  deserializeParsegraphDocument,
  validateParsegraphDocument,
  createPresentation,
  createPresentationPainter,
  createTextMeasurer,
} from "..";

function example() {
  const caret = new DirectionCaret("root");
  caret.node().setId("root");
  caret.node().setRightToLeft(true);
  caret.crease();
  caret.spawn("f", "child").setId("child");
  caret
    .node()
    .neighbors()
    .setAxisOverlap(Direction.FORWARD, AxisOverlap.PREVENTED);
  return serializeParsegraphDocument(caret.root(), {
    presentation: createPresentation(),
  });
}

describe("v1 documents", () => {
  it("accepts, reports, and preserves unknown capabilities and metadata", () => {
    const document = example();
    document.capabilities["future/events/7"] = {
      action: "expand",
      nested: [1, "x"],
    };
    document.metadata = { freeform: { selectedNode: "child" } };
    const loaded = deserializeParsegraphDocument(document);
    expect(loaded.ignoredCapabilities).toEqual(["future/events/7"]);
    expect(serializeParsegraphDocument(loaded.root, loaded)).toEqual(document);
  });

  it("opens a core-only document and one with only an unsupported presentation", () => {
    for (const capabilities of [{}, { "presentation/99": { future: true } }]) {
      const document = { ...example(), capabilities };
      const loaded = deserializeParsegraphDocument(document);
      expect(loaded.root.value()).toBe("root");
      expect(loaded.presentation).toBeUndefined();
      expect(serializeParsegraphDocument(loaded.root, loaded)).toEqual(
        document
      );
    }
  });

  it("rejects malformed known capabilities but treats unknown payloads as opaque", () => {
    const document = example();
    document.capabilities["presentation/1"] = { surprise: true };
    expect(() => deserializeParsegraphDocument(document)).toThrow();
    delete document.capabilities["presentation/1"];
    document.capabilities["unknown/1"] = { surprise: true };
    expect(() => deserializeParsegraphDocument(document)).not.toThrow();
  });

  it("preserves right-to-left, overlap, explicit root crease and presentation", () => {
    const document = example();
    (document.capabilities["presentation/1"] as any).nodeStyles.child = "slot";
    const loaded = deserializeParsegraphDocument(
      JSON.parse(JSON.stringify(document))
    );
    expect(loaded.version).toBe(1);
    expect(loaded.root.rightToLeft()).toBe(true);
    expect(loaded.root.paintGroup().explicit()).toBe(true);
    expect(loaded.root.neighbors().axisOverlap(Direction.FORWARD)).toBe(
      AxisOverlap.PREVENTED
    );
    expect(serializeParsegraphDocument(loaded.root, loaded)).toEqual(document);
  });

  it("allows arbitrary JSON content without interpreting it", () => {
    const value = { kind: "example", nested: [true, null, 42] };
    const node = new DirectionNode(value);
    node.setId("__proto__");
    const document = serializeParsegraphDocument(node);
    const loaded = deserializeParsegraphDocument(document);
    expect(loaded.root.value()).toEqual(value);
    value.nested[2] = 100;
    expect(document.nodes[0].value).not.toEqual(value);
    document.nodes[0].value = "changed";
    expect(loaded.root.value()).not.toBe("changed");
  });

  it("distinguishes an absent value from null and an empty string", () => {
    for (const value of [undefined, null, ""]) {
      const node = new DirectionNode(value);
      const document = serializeParsegraphDocument(node);
      expect(deserializeParsegraphDocument(document).root.value()).toBe(value);
      expect(
        Object.prototype.hasOwnProperty.call(document.nodes[0], "value")
      ).toBe(value !== undefined);
    }
  });

  it("connects records independently of array order", () => {
    const document = example();
    document.nodes.reverse();
    const loaded = deserializeParsegraphDocument(document);
    expect(loaded.root.neighbors().nodeAt(Direction.FORWARD).value()).toBe(
      "child"
    );
  });

  it("keeps wrapped and bare v0 supported but rejects v1 in the graph-only reader", () => {
    const root = new DirectionNode("legacy");
    root.setId("format");
    const legacy = serializeParsegraph(root);
    for (const input of [legacy, legacy.__parsegraph]) {
      const loaded = deserializeParsegraphDocument(input);
      expect(loaded.version).toBe(0);
      expect(loaded.presentation).toBeUndefined();
      expect(loaded.root.value()).toBe("legacy");
    }
    expect(() => deserializeParsegraph(example() as any)).toThrow(
      /deserializeParsegraphDocument/
    );
  });

  it.each([2, "1", null])(
    "rejects unsupported or mistyped version %s",
    (version) => {
      expect(() =>
        deserializeParsegraphDocument({ ...example(), version })
      ).toThrow();
    }
  );

  it.each([
    ["duplicate ID", (doc: any) => doc.nodes.push({ ...doc.nodes[1] })],
    ["numeric ID", (doc: any) => (doc.nodes[0].id = 1)],
    ["missing parent", (doc: any) => (doc.nodes[1].parentId = "missing")],
    ["self parent", (doc: any) => (doc.nodes[1].parentId = "child")],
    ["wrong root", (doc: any) => (doc.root = "child")],
    [
      "extra root",
      (doc: any) => {
        doc.nodes[1].parentId = null;
        doc.nodes[1].parentDir = null;
      },
    ],
    ["invalid direction", (doc: any) => (doc.nodes[1].parentDir = "inward")],
    ["numeric enum", (doc: any) => (doc.nodes[1].fit = 16)],
    ["unknown field", (doc: any) => (doc.nodes[1].mystery = true)],
    ["zero scale", (doc: any) => (doc.nodes[1].scale = 0)],
    ["nonfinite scale", (doc: any) => (doc.nodes[1].scale = Infinity)],
    [
      "negative gap",
      (doc: any) => (doc.capabilities["presentation/1"].spacing.vertical = -1),
    ],
    [
      "unknown style",
      (doc: any) =>
        (doc.capabilities["presentation/1"].defaultStyle = "missing"),
    ],
    [
      "unknown styled node",
      (doc: any) =>
        (doc.capabilities["presentation/1"].nodeStyles.missing = "bud"),
    ],
    [
      "occupied slot",
      (doc: any) => doc.nodes.push({ ...doc.nodes[1], id: "other" }),
    ],
    [
      "disconnected cycle",
      (doc: any) => {
        const base = { ...doc.nodes[1], axisOverlap: "default" };
        doc.nodes.push({
          ...base,
          id: "a",
          parentId: "b",
          parentDir: "backward",
        });
        doc.nodes.push({
          ...base,
          id: "b",
          parentId: "a",
          parentDir: "backward",
        });
      },
    ],
  ])("rejects %s before constructing nodes", (_name, mutate) => {
    const doc = example();
    (mutate as (value: any) => void)(doc);
    expect(() => validateParsegraphDocument(doc)).toThrow(
      /Invalid parsegraph v1/
    );
  });

  it("rejects lossy or circular values", () => {
    const circular: any = {};
    circular.self = circular;
    for (const value of [
      NaN,
      Infinity,
      new Date(),
      { absent: undefined },
      circular,
      () => 1,
    ]) {
      expect(() =>
        serializeParsegraphDocument(new DirectionNode(value))
      ).toThrow();
    }
  });
});

describe("v1 presentation", () => {
  const measure = createTextMeasurer((line) => Array.from(line).length * 6);

  it("defines newline handling and rejects unsupported content", () => {
    const text = createPresentation().text;
    expect(measure("a\r\nbb\r", text)).toEqual([12, 30]);
    expect(measure("", text)).toEqual([0, 10]);
    expect(measure(42, text)).toEqual([12, 10]);
    expect(() => measure({ label: "not automatically text" }, text)).toThrow();
  });

  it("squares node bodies after measurement and padding in math mode", () => {
    const painter = createPresentationPainter(
      createPresentation("math"),
      measure
    );
    const size = [0, 0];
    painter.size(new DirectionNode("12345"), size);
    expect(size).toEqual([36, 36]);
    expect(
      painter.getSeparation(null, Axis.HORIZONTAL, Direction.FORWARD, false)
    ).toBe(0);
  });

  it("includes scaled inward extents in parent sizing", () => {
    const parent = new DirectionNode("P");
    const child = new DirectionNode("nested");
    child.setScale(0.5);
    parent.connect(Direction.INWARD, child);
    parent.neighbors().align(Direction.INWARD, Alignment.INWARD_VERTICAL);
    const painter = createPresentationPainter(createPresentation(), measure);
    const layout = new CommitLayout(parent, painter);
    while (layout.crank());
    const size = [0, 0];
    parent.layout().size(size);
    expect(size).toEqual([27, 27.5]);
  });

  it("expresses verticalStep in parent coordinates, including child scale", () => {
    const parent = new DirectionNode("");
    const child = new DirectionNode("");
    child.setScale(0.5);
    parent.connect(Direction.DOWNWARD, child);
    const painter = createPresentationPainter(
      createPresentation("proportional"),
      measure
    );
    const layout = new CommitLayout(parent, painter);
    while (layout.crank());
    expect(child.layout().absoluteY()).toBe(20);
  });

  it.each(["standard", "proportional", "math"])(
    "matches the %s interoperability fixture",
    (preset) => {
      const fixture = JSON.parse(
        readFileSync(
          resolve(
            __dirname,
            "../../examples/fixtures",
            `proportion-${preset}.parsegraph`
          ),
          "utf8"
        )
      );
      const expected = JSON.parse(
        readFileSync(
          resolve(
            __dirname,
            "../../examples/fixtures",
            `proportion-${preset}.geometry.json`
          ),
          "utf8"
        )
      );
      const loaded = deserializeParsegraphDocument(fixture);
      const saved = serializeParsegraphDocument(loaded.root, loaded);
      const byId = (records: any[]) =>
        Object.fromEntries(records.map((record) => [record.id, record]));
      expect(byId(saved.nodes)).toEqual(byId(fixture.nodes));
      expect(saved.capabilities).toEqual(fixture.capabilities);
      const layout = new CommitLayout(
        loaded.root,
        createPresentationPainter(loaded.presentation, measure)
      );
      let cranks = 0;
      while (layout.crank()) expect(++cranks).toBeLessThan(10000);
      const actual: Record<string, unknown> = {};
      loaded.root.paintGroup().forEach((pg) =>
        pg.siblings().forEach((node) => {
          const size = [0, 0];
          node.layout().size(size);
          actual[String(node.id())] = {
            x: node.layout().absoluteX(),
            y: node.layout().absoluteY(),
            width: size[0],
            height: size[1],
          };
        })
      );
      expect(actual).toEqual(expected);
      if (preset === "proportional") {
        const endpoints = fixture.nodes.filter(
          (n: any) => typeof n.value === "string" && n.value.length > 0
        );
        expect(
          new Set(endpoints.map((n: any) => (actual[n.id] as any).y)).size
        ).toBe(1);
      }
    }
  );
});
