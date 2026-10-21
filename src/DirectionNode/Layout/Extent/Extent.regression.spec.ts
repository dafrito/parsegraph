import { Extent } from "./Extent";

type Bound = [number, number];
const makeExtent = (bounds: Bound[]) => {
  const extent = new Extent();
  bounds.forEach(([length, size]) => extent.appendLS(length, size));
  return extent;
};
const boundsOf = (extent: Extent): Bound[] => {
  const bounds: Bound[] = [];
  extent.forEach((length, size) => bounds.push([length, size]));
  return bounds;
};

// Independent oracle: sample every open interval between all endpoints.
// No Extent equality or two-pointer separation implementation is used here.
function separationOracle(
  a: Extent,
  b: Extent,
  shift: number,
  overlap: boolean,
  scale: number
) {
  const spans = (extent: Extent, origin: number, factor: number) => {
    let end = origin;
    return boundsOf(extent).map(([length, size]) => {
      const start = end;
      end += length * factor;
      return { start, end, size: size * factor };
    });
  };
  const left = spans(a, 0, 1);
  const right = spans(b, shift, scale);
  const endpoints = Array.from(
    new Set([...left, ...right].flatMap((s) => [s.start, s.end]))
  ).sort((x, y) => x - y);
  let result = 0;
  for (let i = 1; i < endpoints.length; ++i) {
    const midpoint = (endpoints[i - 1] + endpoints[i]) / 2;
    const x =
      left.find((s) => s.start < midpoint && midpoint < s.end)?.size ?? NaN;
    const y =
      right.find((s) => s.start < midpoint && midpoint < s.end)?.size ?? NaN;
    if (!isNaN(x) && !isNaN(y)) result = Math.max(result, x + y);
    else if (!overlap)
      result = Math.max(result, isNaN(x) ? 0 : x, isNaN(y) ? 0 : y);
  }
  return result;
}

describe("Extent regression coverage", () => {
  it("preserves bounds when repeated prepends grow a wrapped buffer", () => {
    const extent = new Extent();
    extent.prependLS(1, 10);
    extent.prependLS(2, 20);
    extent.prependLS(3, 30);
    expect(boundsOf(extent)).toEqual([
      [3, 30],
      [2, 20],
      [1, 10],
    ]);
  });

  it.each([false, true])(
    "preserves nonzero ring starts on explicit growth (wrapped=%s)",
    (wrapped) => {
      const extent = new Extent();
      extent.realloc(8);
      extent.prependLS(1, 10);
      extent.prependLS(2, 20);
      if (wrapped) extent.appendLS(3, 30);
      const expected = boundsOf(extent);
      const values = extent.boundingValues();
      extent.realloc(16);
      expect(boundsOf(extent)).toEqual(expected);
      expect(extent.boundingValues()).toEqual(values);
    }
  );

  it("matches a flat model through mixed insertions, growth and clear/reuse", () => {
    const extent = new Extent();
    let model: Bound[] = [];
    let seed = 12345;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    for (let step = 0; step < 600; ++step) {
      if (step % 97 === 0) {
        extent.clear();
        model = [];
      }
      const front = !!((random() >>> 16) & 1);
      const length = 1 + (random() % 20);
      const size = random() % 5 === 0 ? NaN : random() % 17;
      const edge = model[front ? 0 : model.length - 1];
      if (edge && (edge[1] === size || (isNaN(edge[1]) && isNaN(size))))
        edge[0] += length;
      else if (front) model.unshift([length, size]);
      else model.push([length, size]);
      if (front) extent.prependLS(length, size);
      else extent.appendLS(length, size);
      if (step % 31 === 0) extent.realloc(extent.boundCapacity() + 1);
      expect(boundsOf(extent)).toEqual(model);
    }
  });

  it("transfers bounds without sharing storage after either object is reused", () => {
    const source = makeExtent([[1, 10]]);
    const dest = makeExtent([[8, 80]]);
    source.boundingValues();
    dest.boundingValues();
    source.setOffset(7);
    dest.setOffset(42);
    dest.copyFrom(source);
    expect(boundsOf(source)).toEqual([]);
    expect(dest.boundingValues()).toEqual([1, 10, 10]);
    expect(source.boundingValues()).toEqual([0, NaN, NaN]);
    // Offsets belong to their layout slots, not the transferred bounds.
    expect(source.offset()).toBe(7);
    expect(dest.offset()).toBe(42);
    source.appendLS(1, 99);
    expect(boundsOf(dest)).toEqual([[1, 10]]);
    dest.setBoundSizeAt(0, 55);
    expect(boundsOf(source)).toEqual([[1, 99]]);
  });

  it("transfers ring position and handles self-transfer and empty sources", () => {
    const source = new Extent();
    source.prependLS(1, 10);
    source.prependLS(2, 20);
    const dest = makeExtent([[9, 90]]);
    dest.copyFrom(source);
    expect(boundsOf(dest)).toEqual([
      [2, 20],
      [1, 10],
    ]);
    dest.copyFrom(dest);
    expect(boundsOf(dest)).toEqual([
      [2, 20],
      [1, 10],
    ]);
    dest.copyFrom(source);
    expect(dest.boundingValues()).toEqual([0, NaN, NaN]);
    dest.appendLS(3, 30);
    source.appendLS(4, 40);
    expect(boundsOf(dest)).toEqual([[3, 30]]);
    expect(boundsOf(source)).toEqual([[4, 40]]);
  });

  it("combines into a destination with a nonzero ring start", () => {
    const extent = new Extent();
    extent.realloc(8);
    extent.prependLS(10, 2);
    extent.setOffset(17);
    extent.combineExtent(makeExtent([[4, 8]]), 3, 0, 1);
    expect(boundsOf(extent)).toEqual([
      [3, 2],
      [4, 8],
      [3, 2],
    ]);
    expect(extent.offset()).toBe(17);
    extent.combineBound(0, 1, 9);
    expect(boundsOf(extent)).toEqual([
      [1, 9],
      [2, 2],
      [4, 8],
      [3, 2],
    ]);
    expect(extent.offset()).toBe(17);
  });

  it("counts both tails when axis overlap is forbidden", () => {
    const a = makeExtent([
      [1, 1],
      [1, 100],
    ]);
    const b = makeExtent([[1, 1]]);
    expect(a.separation(b, 0, false)).toBe(100);
    expect(b.separation(a, 0, false)).toBe(100);
    expect(a.separation(b, 0, true)).toBe(2);
    expect(a.separation(new Extent(), 0, false)).toBe(100);
    expect(a.separation(new Extent(), 0, true)).toBe(0);
  });

  it("counts partial prefixes when signed sizes reduce overlapping separation", () => {
    const a = makeExtent([[2, -1]]);
    const b = makeExtent([[2, 10]]);
    expect(a.separation(b, -1, false)).toBe(10);
    expect(b.separation(a, 1, false)).toBe(10);
    expect(a.separation(b, -1, true)).toBe(9);
  });

  it("matches interval geometry and scaled symmetry across gaps and offsets", () => {
    let seed = 0x183ec7;
    const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
    const generate = () =>
      makeExtent(
        Array.from(
          { length: random() % 8 },
          (): Bound => [
            (1 + (random() % 20)) / 4,
            random() % 4 === 0 ? NaN : ((random() % 60) - 20) / 4,
          ]
        )
      );
    for (let i = 0; i < 300; ++i) {
      const a = generate(),
        b = generate();
      const shift = ((random() % 80) - 40) / 4;
      const scale = [0.25, 0.5, 1, 2, 4][random() % 5];
      for (const overlap of [false, true]) {
        const actual = a.separation(b, shift, overlap, scale);
        expect(actual).toBeCloseTo(
          separationOracle(a, b, shift, overlap, scale),
          10
        );
        expect(actual).toBeCloseTo(
          scale * b.separation(a, -shift / scale, overlap, 1 / scale),
          10
        );
      }
    }
  });

  it("compares signed sizes and applies tolerance consistently", () => {
    expect(makeExtent([[1, -10]]).equals(makeExtent([[1, 10]]), 1e-6)).toBe(
      false
    );
    const a = makeExtent([
      [1, 1],
      [2, NaN],
    ]);
    const b = makeExtent([
      [1.125, 1.125],
      [2, NaN],
    ]);
    expect(a.equals(b, 0.25)).toBe(true);
    expect(a.equals(b, 0)).toBe(false);
    expect(a.equals(b, 0.125)).toBe(false);
    expect(makeExtent([[1, 1]]).equals(makeExtent([[1, 1.125]]), 0.25)).toBe(
      true
    );
    expect(makeExtent([[1, NaN]]).equals(makeExtent([[1, 0]]), 1)).toBe(false);
  });
});
