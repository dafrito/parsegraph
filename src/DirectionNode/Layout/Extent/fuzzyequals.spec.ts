const assert = require("assert");
import fuzzyEquals, {
  cloneFuzziness,
  getFuzziness,
  setFuzziness,
} from "./fuzzyequals";

describe("fuzzyEquals", function () {
  it("treats equal numbers as equal", () => {
    assert.equal(fuzzyEquals(1, 1, 0.1), true);
  });
  it("treats close numbers as equal", () => {
    assert.equal(fuzzyEquals(1, 1.0000001, 0.1), true);
  });
  it("treats grossly unequal numbers as unequal", () => {
    assert.ok(!fuzzyEquals(1, 2.0000001, 0.1));
  });
  it("treats equal numbers as equal without fuzziness", () => {
    assert.ok(fuzzyEquals(1, 1));
  });
  it("treats close numbers as unequal without fuzziness", () => {
    assert.ok(fuzzyEquals(1, 1.0000001));
  });

  it("treats negative numbers appropriately", () => {
    assert.ok(!fuzzyEquals(-1, 0, 0.1));
    assert.ok(!fuzzyEquals(-1, -0.5, 0.1));
  });

  it("can be changed globally", () => {
    setFuzziness(1);
    assert.equal(getFuzziness(), 1);
    assert.equal(fuzzyEquals(1, 1.1), true);
    setFuzziness(0.0001);
    assert.equal(getFuzziness(), 0.0001);
    assert.equal(fuzzyEquals(1, 1.1), false);
  });
});

describe("Fuzziness", function () {
  it("can be changed", () => {
    const fuzziness = cloneFuzziness();
    fuzziness.setFuzziness(1);
    assert.equal(fuzziness.check(1, 1.1), true);
    fuzziness.setFuzziness(0.0001);
    assert.equal(fuzziness.check(1, 1.1), false);
  });
  it("uses default fuzziness", () => {
    setFuzziness(0.0001);
    assert.equal(getFuzziness(), 0.0001);

    const fuzziness = cloneFuzziness();
    assert.equal(fuzziness.getFuzziness(), getFuzziness());

    fuzziness.setFuzziness(1);
    assert.equal(fuzziness.getFuzziness(), 1);
  });
  it("is subject to default fuzziness", () => {
    setFuzziness(0.0001);
    const fuzziness = cloneFuzziness();
    assert.equal(
      fuzziness.getFuzziness(),
      0.0001,
      "cloned fuzziness initially uses the default fuzziness"
    );
    fuzziness.resetFuzziness();

    setFuzziness(1);
    assert.equal(
      fuzziness.getFuzziness(),
      1,
      "Reset fuzziness will default to the current default fuzziness"
    );

    assert.equal(
      fuzziness.check(1, 1.1),
      true,
      "Large fuzziness should treat close values as equal"
    );
  });
  it("can be set to zero", () => {
    setFuzziness(0);
    assert.equal(fuzzyEquals(1, 1.000001), false);
  });
  it("handles both NaN appropriately (fuzzy)", () => {
    setFuzziness(0.0001);
    assert.equal(fuzzyEquals(NaN, NaN), false);
  });
  it("handles both NaN appropriately (exact)", () => {
    setFuzziness(0);
    assert.equal(fuzzyEquals(NaN, NaN), false);
  });
  it("handles NaN appropriately (exact)", () => {
    setFuzziness(0);
    assert.equal(fuzzyEquals(NaN, 1), false);
    assert.equal(fuzzyEquals(1, NaN), false);
  });
  it("handles NaN appropriately (fuzzy)", () => {
    setFuzziness(0.0001);
    assert.equal(fuzzyEquals(NaN, 1), false);
    assert.equal(fuzzyEquals(1, NaN), false);
  });
});
