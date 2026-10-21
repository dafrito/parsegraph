import {
  DirectionCaret,
  createPresentation,
  serializeParsegraph,
  serializeParsegraphDocument,
  deserializeParsegraphDocument,
} from "../../src";
import { buildUlamDocument } from "../../examples/generators/ulam";
import { buildPrimesDocument } from "../../examples/generators/primes";
import { buildRainbowDocument } from "../../examples/generators/rainbow";
import { buildMemoryPiersDocument } from "../../examples/generators/memory-piers";
import { createSeededRandom } from "../../examples/generators/random";
import { renderSvg } from "./render";
import { readFileSync } from "fs";
import { resolve } from "path";

// Deterministic metrics for geometry assertions. Real Chrome exports separately
// verify the installed font engine; these tests need no browser executable.
beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    font: "10px sans-serif",
    measureText: (text) => ({
      width: Array.from(text).length * 6,
      actualBoundingBoxAscent: 7,
      actualBoundingBoxDescent: 2,
    }),
  });
  Object.defineProperty(document, "fonts", {
    configurable: true,
    value: { load: async () => [], ready: Promise.resolve() },
  });
});
afterEach(() => jest.restoreAllMocks());

const parse = (svg) =>
  new DOMParser().parseFromString(svg, "image/svg+xml").documentElement;

it.each([false, true])(
  "renders rainbow appearance in orientation %s",
  async (vertical) => {
    const graph = buildRainbowDocument(3, vertical);
    expect(graph.nodes).toHaveLength(40);
    expect(graph.nodes.every((node) => node.value === undefined)).toBe(true);
    const appearance = graph.capabilities["appearance/1"];
    expect(Object.keys(appearance.nodeStyles)).toHaveLength(27);
    expect(graph.nodes.find((node) => node.id === "rainbow-1").parentDir).toBe(
      vertical ? "upward" : "backward"
    );
    const image = parse((await renderSvg(graph)).svg);
    expect(image.children[1].getAttribute("fill")).toBe("#383838");
    for (const node of graph.nodes) {
      const body = image.querySelector(`[data-node-id="${node.id}"] rect`);
      const colors = {
        ...appearance.defaults,
        ...appearance.nodeStyles[node.id],
      };
      expect(body.getAttribute("fill")).toBe(colors.backgroundColor);
      expect(Number(body.getAttribute("fill-opacity"))).toBe(
        colors.backgroundAlpha
      );
    }
    expect(buildRainbowDocument(3, !vertical).capabilities).toEqual(
      graph.capabilities
    );
    expect(() => buildRainbowDocument(1)).toThrow("Count");
  }
);

it("renders appearance colors and separate alpha channels without changing geometry", async () => {
  const graph = JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        "../../examples/fixtures/appearance-colors.parsegraph"
      ),
      "utf8"
    )
  );
  const rendered = await renderSvg(graph);
  expect(rendered.ignoredCapabilities).toEqual([]);
  const image = parse(rendered.svg);
  const child = image.querySelector('[data-node-id="child"]');
  expect(child.querySelector("rect").getAttribute("fill")).toBe("#3366ff");
  expect(child.querySelector("rect").getAttribute("fill-opacity")).toBe("0.5");
  expect(child.querySelector("rect").getAttribute("stroke-opacity")).toBe("0");
  expect(child.querySelector("text").getAttribute("fill")).toBe("#ffffff");
  expect(
    image
      .querySelector('[data-node-id="transparent"] rect')
      .getAttribute("fill-opacity")
  ).toBe("0");
  expect(image.querySelectorAll('rect[fill="#ff0000"]')).toHaveLength(2);
  expect(
    image.querySelector('rect[fill="#ff0000"]').getAttribute("fill-opacity")
  ).toBe("0.6");
  expect(image.children[1].getAttribute("fill")).toBe("#f1f5f9");
  expect(image.children[1].getAttribute("fill-opacity")).toBe("0.5");
  delete graph.capabilities["appearance/1"];
  const plain = parse((await renderSvg(graph)).svg);
  expect(plain.getAttribute("viewBox")).toBe(image.getAttribute("viewBox"));
  for (const body of image.querySelectorAll("[data-node-id]")) {
    expect(body.getAttribute("transform")).toBe(
      plain
        .querySelector(`[data-node-id="${body.getAttribute("data-node-id")}"]`)
        .getAttribute("transform")
    );
  }
});

it("reproduces seeded memory piers and retains the recipe through loading", async () => {
  const random = createSeededRandom(42);
  expect(Array.from({ length: 5 }, () => random() * 4294967296)).toEqual([
    1083814273, 378494188, 2479403867, 955863294, 1613448261,
  ]);
  const graph = buildMemoryPiersDocument(4, 42);
  expect(buildMemoryPiersDocument(4, 42)).toEqual(graph);
  expect(buildMemoryPiersDocument(4, 43).nodes).not.toEqual(graph.nodes);
  expect(graph.capabilities["generation/1"]).toEqual({
    generator: { name: "memory-piers", revision: 1 },
    random: { algorithm: "lcg32/1", seed: 42 },
    parameters: { count: 4 },
  });
  const loaded = deserializeParsegraphDocument(graph);
  expect(serializeParsegraphDocument(loaded.root, loaded).capabilities).toEqual(
    graph.capabilities
  );
  const { svg, ignoredCapabilities } = await renderSvg(graph);
  expect(ignoredCapabilities).toContain("generation/1");
  const image = parse(svg);
  expect(image.querySelectorAll("[data-node-id]")).toHaveLength(
    graph.nodes.length
  );
  const styles = graph.capabilities["presentation/1"].nodeStyles;
  const slotPositions = [];
  for (const node of graph.nodes) {
    const body = image.querySelector(`[data-node-id="${node.id}"]`);
    if (styles[node.id] === "slider") {
      expect(
        Number(body.querySelector("rect").getAttribute("width"))
      ).toBeGreaterThan(300);
      const parent = graph.nodes.find(
        (candidate) => candidate.id === node.parentId
      );
      expect(styles[parent.id]).toBe("block");
      expect(node.parentDir).toBe("upward");
    }
    if (styles[node.id] === "slot") {
      slotPositions.push(
        Number(
          body.getAttribute("transform").match(/translate\([^ ]+ ([^)]+)\)/)[1]
        )
      );
    }
  }
  expect(slotPositions.filter((y) => y > 0)).toHaveLength(8);
  expect(slotPositions.filter((y) => y < 0)).toHaveLength(8);
  expect(() => createSeededRandom(-1)).toThrow("Seed");
  expect(() => createSeededRandom(4294967296)).toThrow("Seed");
  expect(() => createSeededRandom(0)).not.toThrow();
  expect(() => buildMemoryPiersDocument(0, 42)).toThrow("Count");
});

it("renders prime-divisor columns in aligned rows, including empty slots", async () => {
  const primes = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];
  const graph = buildPrimesDocument(30);
  const records = new Map(graph.nodes.map((node) => [node.id, node]));
  const { svg, nodes } = await renderSvg(graph);
  const image = parse(svg);
  expect(nodes).toBe(
    30 + primes.reduce((total, prime) => total + 31 - prime, 0)
  );
  const rows = new Map();
  for (let number = 1; number <= 30; ++number) {
    const base = image.querySelector(`[data-node-id="primes-${number}"]`);
    expect(base.querySelector("text").textContent).toBe(String(number));
    expect(base.getAttribute("transform")).toMatch(/ 0\) scale\(1\)$/);
    for (const prime of primes.filter((p) => p <= number)) {
      const id = `primes-${number}-factor-${prime}`;
      const node = image.querySelector(`[data-node-id="${id}"]`);
      const divides = number % prime === 0;
      expect(records.get(id).value).toBe(divides ? String(prime) : "");
      expect(node.querySelector("rect").getAttribute("fill")).toBe(
        divides ? "#d9f99d" : "#f8fafc"
      );
      const y = Number(
        node.getAttribute("transform").match(/translate\([^ ]+ ([^)]+)\)/)[1]
      );
      if (rows.has(prime)) expect(y).toBeCloseTo(rows.get(prime), 5);
      else rows.set(prime, y);
    }
  }
  expect(buildPrimesDocument(1).nodes).toHaveLength(1);
  expect(() => buildPrimesDocument(0)).toThrow("Count");
});

it("exports the Ulam grid with correct prime roles and scalable dimensions", async () => {
  const graph = buildUlamDocument(8);
  const { svg, nodes } = await renderSvg(graph, { width: 320 });
  const image = parse(svg);
  expect(nodes).toBe(57);
  expect(image.getAttribute("width")).toBe("320");
  const positions = new Set();
  for (const body of image.querySelectorAll("[data-node-id]")) {
    const id = body.getAttribute("data-node-id");
    const n = Number(id.slice(5));
    const prime =
      n >= 2 &&
      !Array.from({ length: Math.max(0, n - 2) }, (_, i) => i + 2).some(
        (factor) => n % factor === 0
      );
    expect(body.querySelector("rect").getAttribute("fill")).toBe(
      id === "ulam-root" || prime ? "#d9f99d" : "#f8fafc"
    );
    expect(positions.has(body.getAttribute("transform"))).toBe(false);
    positions.add(body.getAttribute("transform"));
  }
});

it("places connectors correctly across nested scaled paint groups", async () => {
  const caret = new DirectionCaret("");
  caret.spawnMove("f", "").setScale(0.5);
  caret.crease();
  caret.spawnMove("f", "").setScale(0.5);
  caret.crease();
  const presentation = createPresentation();
  presentation.styles.block = {
    minWidth: 20,
    minHeight: 20,
    paddingX: 0,
    paddingY: 0,
    square: true,
  };
  const { svg } = await renderSvg(
    serializeParsegraphDocument(caret.root(), { presentation })
  );
  const image = parse(svg);
  const lines = Array.from(image.querySelectorAll('rect[fill="#64748b"]'));
  expect(lines.map((line) => Number(line.getAttribute("x")))).toEqual([
    10, 22.5,
  ]);
  expect(lines.map((line) => Number(line.getAttribute("width")))).toEqual([
    2.5, 1.25,
  ]);
  expect(
    Array.from(image.querySelectorAll("[data-node-id]")).map((node) =>
      node.getAttribute("transform")
    )
  ).toEqual([
    "translate(0 0) scale(1)",
    "translate(17.5 0) scale(0.5)",
    "translate(26.25 0) scale(0.25)",
  ]);
});

it("keeps inward connectors above the containing body", async () => {
  const caret = new DirectionCaret("container");
  caret.node().setId("container");
  caret.spawnMove("i", "inside");
  caret.spawnMove("f", "neighbor");
  const { svg } = await renderSvg(
    serializeParsegraphDocument(caret.root(), {
      presentation: createPresentation(),
    })
  );
  const image = parse(svg);
  const container = image.querySelector('[data-node-id="container"]');
  const connector = image.querySelector('rect[fill="#64748b"]');
  expect(
    container.compareDocumentPosition(connector) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});

it("preserves literal multiline labels and safely exports legacy files", async () => {
  const label = '<script>alert("&")</script>\n雪';
  const caret = new DirectionCaret(label);
  const { svg } = await renderSvg(serializeParsegraph(caret.root()));
  const image = parse(svg);
  expect(image.querySelector("parsererror, script")).toBeNull();
  expect(
    Array.from(image.querySelectorAll("text")).map((line) => line.textContent)
  ).toEqual(label.split("\n"));
});

it("reports unknown capabilities and rejects unsupported structured content", async () => {
  const caret = new DirectionCaret("label");
  const graph = serializeParsegraphDocument(caret.root(), {
    capabilities: { "future/1": { anything: true } },
  });
  expect((await renderSvg(graph)).ignoredCapabilities).toEqual(["future/1"]);
  caret.node().setValue({ label: "custom" });
  await expect(
    renderSvg(serializeParsegraphDocument(caret.root()))
  ).rejects.toThrow("content adapter");
  await expect(renderSvg(graph, { width: 0 })).rejects.toThrow("positive");
});
