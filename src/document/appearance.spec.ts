import { readFileSync } from "fs";
import { resolve } from "path";
import {
  Appearance,
  deserializeParsegraphDocument,
  serializeParsegraphDocument,
  validateParsegraphDocument,
  resolveNodeAppearance,
} from "..";

const example = () =>
  JSON.parse(
    readFileSync(
      resolve(
        __dirname,
        "../../examples/fixtures/appearance-colors.parsegraph"
      ),
      "utf8"
    )
  );

it("preserves and resolves optional appearance independently of presentation", () => {
  const doc = example();
  delete doc.capabilities["presentation/1"];
  const loaded = deserializeParsegraphDocument(doc);
  expect(loaded.ignoredCapabilities).toEqual([]);
  expect(loaded.appearance).toEqual(doc.capabilities["appearance/1"]);
  const child = resolveNodeAppearance(loaded.appearance, "child");
  expect(child.backgroundAlpha).toBe(0.5);
  expect(child.borderAlpha).toBe(0);
  expect(child.lineColor).toBe("#64748b"); // No inheritance from root's red line.
  expect(
    resolveNodeAppearance(loaded.appearance, "transparent").backgroundAlpha
  ).toBe(0);
  expect(serializeParsegraphDocument(loaded.root, loaded).capabilities).toEqual(
    doc.capabilities
  );
  const plain = serializeParsegraphDocument(loaded.root);
  expect(plain.capabilities).toEqual({});
  expect(deserializeParsegraphDocument(plain).appearance).toBeUndefined();
});

it("uses own properties for node appearance and lets shorthand replace a payload", () => {
  const doc = example();
  const appearance = doc.capabilities["appearance/1"] as Appearance;
  expect(resolveNodeAppearance(appearance, "__proto__")).toEqual(
    appearance.defaults
  );
  const node = doc.nodes.find((n: { id: string }) => n.id === "child");
  node.id = "__proto__";
  delete doc.capabilities["presentation/1"];
  appearance.nodeStyles = JSON.parse('{"__proto__":{"backgroundAlpha":0}}');
  const loaded = deserializeParsegraphDocument(doc);
  expect(
    resolveNodeAppearance(loaded.appearance, "__proto__").backgroundAlpha
  ).toBe(0);
  const replacement = { ...appearance, pageBackgroundAlpha: 0 };
  expect(
    serializeParsegraphDocument(loaded.root, {
      ...loaded,
      appearance: replacement,
    }).capabilities["appearance/1"]
  ).toEqual(replacement);
});

it.each([
  (a: any) => {
    delete a.defaults.textColor;
  },
  (a: any) => {
    a.defaults.backgroundColor = "red";
  },
  (a: any) => {
    a.defaults.backgroundColor = "#fff";
  },
  (a: any) => {
    a.defaults.backgroundColor = "url(https://example.com)";
  },
  (a: any) => {
    a.defaults.backgroundAlpha = -0.1;
  },
  (a: any) => {
    a.pageBackgroundAlpha = 1.1;
  },
  (a: any) => {
    a.pageBackgroundAlpha = NaN;
  },
  (a: any) => {
    a.nodeStyles.child = null;
  },
  (a: any) => {
    a.nodeStyles.child.extra = true;
  },
  (a: any) => {
    a.nodeStyles.missing = {};
  },
  (a: any) => {
    a.styles = {};
  },
])("rejects malformed supported appearance %#", (mutate) => {
  const doc = example();
  mutate(doc.capabilities["appearance/1"]);
  expect(() => validateParsegraphDocument(doc)).toThrow();
});
