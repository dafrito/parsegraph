import { ParsegraphDocument } from "./types";

export const DIRECTIONS = [
  "inward",
  "outward",
  "downward",
  "upward",
  "forward",
  "backward",
] as const;
export const FITS = ["exact", "loose", "naive"] as const;
export const PREFERENCES = [
  "parent",
  "perpendicular",
  "horizontal",
  "vertical",
] as const;
export const ALIGNMENTS = [
  "none",
  "negative",
  "center",
  "positive",
  "inward-horizontal",
  "inward-vertical",
] as const;
export const OVERLAPS = ["allowed", "prevented", "default"] as const;

/**
 * Bare v0 maps may legitimately contain nodes named format or version.
 * @param {unknown} value - A candidate document or legacy node map.
 * @return {boolean} Whether scalar format/version markers are present.
 */
export function hasVersionMarker(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return ["format", "version"].some((key) => {
    if (!Object.prototype.hasOwnProperty.call(value, key)) return false;
    const field = (value as Record<string, unknown>)[key];
    return field === null || typeof field !== "object";
  });
}

/**
 * @param {unknown} ok - Condition to require.
 * @param {string} message - Error detail when the condition fails.
 */
function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`Invalid parsegraph v1: ${message}`);
}

/** @param {unknown} value - Value that must be an object rather than an array. */
function object(value: unknown): asserts value is Record<string, unknown> {
  check(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "expected an object"
  );
}

/**
 * @param {object} value - Object to check.
 * @param {string[]} required - Required property names.
 * @param {string[]} optional - Additional permitted property names.
 */
function fields(
  value: Record<string, unknown>,
  required: string[],
  optional: string[] = []
) {
  required.forEach((key) =>
    check(Object.prototype.hasOwnProperty.call(value, key), `missing ${key}`)
  );
  Object.keys(value).forEach((key) =>
    check(
      required.includes(key) || optional.includes(key),
      `unknown field ${key}`
    )
  );
}

/**
 * @param {unknown} value - Numeric input.
 * @param {boolean} positive - Whether zero is forbidden.
 */
function number(value: unknown, positive = false) {
  check(
    typeof value === "number" &&
      Number.isFinite(value) &&
      (positive ? value > 0 : value >= 0),
    "invalid numeric dimension or scale"
  );
}

/**
 * @param {unknown} value - Enum input.
 * @param {string[]} options - Permitted spellings.
 */
function choice(value: unknown, options: readonly string[]) {
  check(
    typeof value === "string" && options.includes(value),
    `unknown enum value ${String(value)}`
  );
}

/**
 * Reject lossy values rather than silently applying JSON.stringify coercions.
 * @param {unknown} value - Input to inspect.
 * @param {Set} seen - Objects on the current recursion path.
 * @param {number} depth - Current JSON nesting level.
 */
export function assertJson(
  value: unknown,
  seen = new Set<object>(),
  depth = 0
): void {
  check(depth <= 100, "JSON nesting exceeds 100 levels");
  if (value === null || typeof value === "string" || typeof value === "boolean")
    return;
  if (typeof value === "number") {
    check(Number.isFinite(value), "non-finite JSON number");
    return;
  }
  check(typeof value === "object", "value is not JSON-compatible");
  check(!seen.has(value), "circular JSON value");
  seen.add(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; ++i)
      assertJson(value[i], seen, depth + 1);
  } else {
    const prototype = Object.getPrototypeOf(value);
    check(
      prototype === Object.prototype || prototype === null,
      "expected a plain JSON object"
    );
    check(
      Object.getOwnPropertySymbols(value).length === 0,
      "symbol keys are not JSON-compatible"
    );
    Object.keys(value).forEach((key) =>
      assertJson((value as Record<string, unknown>)[key], seen, depth + 1)
    );
  }
  seen.delete(value);
}

/** @param {unknown} value - A candidate node record. */
function validateNode(value: unknown) {
  object(value);
  fields(
    value,
    [
      "id",
      "scale",
      "fit",
      "layoutPreference",
      "parentId",
      "parentDir",
      "alignment",
      "axisOverlap",
      "rightToLeft",
      "paintGroup",
    ],
    ["value"]
  );
  check(
    typeof value.id === "string" && value.id.length > 0,
    "node ID must be a nonempty string"
  );
  number(value.scale, true);
  choice(value.fit, FITS);
  choice(value.layoutPreference, PREFERENCES);
  choice(value.alignment, ALIGNMENTS);
  choice(value.axisOverlap, OVERLAPS);
  check(
    typeof value.rightToLeft === "boolean" &&
      typeof value.paintGroup === "boolean",
    "expected node boolean flags"
  );
  if (value.parentId === null) {
    check(
      value.parentDir === null &&
        value.alignment === "none" &&
        value.axisOverlap === "default",
      "invalid root connection fields"
    );
    choice(value.layoutPreference, ["horizontal", "vertical"]);
  } else {
    check(
      typeof value.parentId === "string" && value.parentId.length > 0,
      "invalid parent ID"
    );
    // A parent cannot spawn an OUTWARD child; such a child would point INWARD.
    choice(
      value.parentDir,
      DIRECTIONS.filter((direction) => direction !== "inward")
    );
    const inwardAlignment = String(value.alignment).startsWith("inward-");
    if (value.parentDir === "outward") {
      check(
        value.alignment === "none" || inwardAlignment,
        "invalid containment alignment"
      );
    } else {
      check(!inwardAlignment, "inward alignment requires an inward child");
    }
  }
}

/**
 * @param {unknown} value - A candidate presentation capability payload.
 * @param {Set} ids - Existing node IDs for style reference checks.
 */
function validatePresentation(value: unknown, ids: Set<string>) {
  object(value);
  fields(value, ["text", "styles", "defaultStyle", "nodeStyles", "spacing"]);
  object(value.text);
  fields(value.text, ["fontFamily", "fontSize", "lineHeight"]);
  check(
    typeof value.text.fontFamily === "string" &&
      value.text.fontFamily.trim().length > 0,
    "invalid font family"
  );
  number(value.text.fontSize, true);
  number(value.text.lineHeight, true);
  object(value.styles);
  check(Object.keys(value.styles).length > 0, "styles cannot be empty");
  Object.entries(value.styles).forEach(([name, style]) => {
    check(name.length > 0, "empty style name");
    object(style);
    fields(style, ["minWidth", "minHeight", "paddingX", "paddingY", "square"]);
    [style.minWidth, style.minHeight, style.paddingX, style.paddingY].forEach(
      (v) => number(v)
    );
    check(typeof style.square === "boolean", "square must be boolean");
  });
  choice(value.defaultStyle, Object.keys(value.styles));
  object(value.nodeStyles);
  Object.entries(value.nodeStyles).forEach(([id, name]) => {
    check(ids.has(id), `style references unknown node ${id}`);
    choice(name, Object.keys(value.styles));
  });
  object(value.spacing);
  fields(value.spacing, ["horizontal", "vertical", "inward"], ["verticalStep"]);
  [
    value.spacing.horizontal,
    value.spacing.vertical,
    value.spacing.inward,
  ].forEach((v) => number(v));
  if (value.spacing.verticalStep !== undefined)
    number(value.spacing.verticalStep, true);
}

/**
 * @param {unknown} value - Appearance capability to validate.
 * @param {Set} ids - Valid node IDs.
 */
function validateAppearance(value: unknown, ids: Set<string>) {
  object(value);
  fields(value, [
    "defaults",
    "nodeStyles",
    "pageBackgroundColor",
    "pageBackgroundAlpha",
  ]);
  const colors = ["backgroundColor", "borderColor", "textColor", "lineColor"];
  const alphas = ["backgroundAlpha", "borderAlpha", "textAlpha", "lineAlpha"];
  const color = (v: unknown) =>
    check(
      typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v),
      "expected #RRGGBB color"
    );
  const alpha = (v: unknown) => {
    number(v);
    check((v as number) <= 1, "alpha exceeds 1");
  };
  const style = (v: unknown, partial: boolean) => {
    object(v);
    fields(
      v,
      partial ? [] : [...colors, ...alphas],
      partial ? [...colors, ...alphas] : []
    );
    Object.entries(v).forEach(([key, entry]) =>
      colors.includes(key) ? color(entry) : alpha(entry)
    );
  };
  style(value.defaults, false);
  object(value.nodeStyles);
  Object.entries(value.nodeStyles).forEach(([id, entry]) => {
    check(ids.has(id), `appearance references unknown node ${id}`);
    style(entry, true);
  });
  color(value.pageBackgroundColor);
  alpha(value.pageBackgroundAlpha);
}

/**
 * Validate the whole document before graph mutations can replace connections.
 * @param {unknown} value - A candidate v1 document.
 */
export function validateParsegraphDocument(
  value: unknown
): asserts value is ParsegraphDocument {
  assertJson(value);
  object(value);
  fields(
    value,
    ["format", "version", "root", "nodes", "capabilities"],
    ["metadata"]
  );
  check(
    value.format === "parsegraph" && value.version === 1,
    "unsupported format/version"
  );
  object(value.capabilities);
  Object.keys(value.capabilities).forEach((name) =>
    check(name.length > 0, "empty capability name")
  );
  if (value.metadata !== undefined) object(value.metadata);
  check(
    typeof value.root === "string" && value.root.length > 0,
    "invalid root ID"
  );
  check(
    Array.isArray(value.nodes) && value.nodes.length > 0,
    "nodes must be a nonempty array"
  );
  value.nodes.forEach(validateNode);
  const document = value as unknown as ParsegraphDocument;
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  check(nodes.size === document.nodes.length, "duplicate node IDs");
  const roots = document.nodes.filter((node) => node.parentId === null);
  check(
    roots.length === 1 && roots[0].id === document.root,
    "expected exactly the declared root"
  );
  const children = new Map<string, string[]>();
  const slots = new Map<string, Set<string>>();
  document.nodes.forEach((node) => {
    if (node.parentId === null) return;
    const parent = nodes.get(node.parentId);
    check(parent, `unknown parent ${node.parentId}`);
    check(node.id !== node.parentId, "self-parent connection");
    const dir =
      DIRECTIONS[
        DIRECTIONS.indexOf(node.parentDir as (typeof DIRECTIONS)[number]) ^ 1
      ];
    check(
      dir !== parent.parentDir,
      "child conflicts with parent's parent direction"
    );
    const occupied = slots.get(parent.id) || new Set<string>();
    check(!occupied.has(dir), "multiple children in the same direction");
    occupied.add(dir);
    slots.set(parent.id, occupied);
    const list = children.get(parent.id) || [];
    list.push(node.id);
    children.set(parent.id, list);
  });
  const visited = new Set<string>();
  const pending = [document.root];
  while (pending.length) {
    const id = pending.pop() as string;
    check(!visited.has(id), "cycle in graph");
    visited.add(id);
    (children.get(id) || []).forEach((child) => pending.push(child));
  }
  check(visited.size === nodes.size, "disconnected nodes or cycle");
  if (
    Object.prototype.hasOwnProperty.call(
      document.capabilities,
      "presentation/1"
    )
  ) {
    validatePresentation(
      document.capabilities["presentation/1"],
      new Set(nodes.keys())
    );
  }
  if (
    Object.prototype.hasOwnProperty.call(document.capabilities, "appearance/1")
  ) {
    validateAppearance(
      document.capabilities["appearance/1"],
      new Set(nodes.keys())
    );
  }
}
