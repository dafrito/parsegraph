import { assert } from "chai";
import { Extent } from "./Extent";

describe("Extent", function () {
  it("can simplify", () => {
    const extent = new Extent();
    extent.appendLS(10, 20);
    extent.appendLS(5, 20);
    extent.simplify();
    assert.equal(
      extent.numBounds(),
      1,
      "Simplify must merge bounds with equal sizes."
    );
  });

  it("Extent.numBounds", function () {
    const extent = new Extent();
    assert.equal(
      extent.numBounds(),
      0,
      "Extent must begin with an empty numBounds."
    );
    extent.appendLS(1, 15);
    assert.equal(extent.numBounds(), 1, "Append must only add one bound.");
    extent.appendLS(1, 20);
    extent.appendLS(1, 25);
    assert.equal(
      extent.numBounds(),
      3,
      "Append must only add one bound per call."
    );
  });

  it("Extent.separation", function () {
    const forwardExtent = new Extent();
    const backwardExtent = new Extent();

    const testSeparation = function (expected) {
      return (
        forwardExtent.separation(backwardExtent) ==
          backwardExtent.separation(forwardExtent) &&
        forwardExtent.separation(backwardExtent) == expected
      );
    };

    forwardExtent.appendLS(50, 10);
    backwardExtent.appendLS(50, 10);
    assert.ok(
      testSeparation(20),
      "For single bounds, separation should be equivalent to the size of the " +
        "forward and backward extents."
    );

    backwardExtent.appendLS(50, 20);
    forwardExtent.appendLS(50, 20);
    assert.ok(testSeparation(40), "More space");

    backwardExtent.appendLS(50, 20);
    forwardExtent.appendLS(50, 40);
    assert.ok(testSeparation(60), "Even more space");

    backwardExtent.appendLS(50, 10);
    forwardExtent.appendLS(50, 10);
    assert.ok(testSeparation(60), "No actual change");
  });

  it("Extent.Simple combinedExtent", () => {
    const rootNode = new Extent();
    const forwardNode = new Extent();

    rootNode.appendLS(50, 25);
    forwardNode.appendLS(12, 6);
    const separation = rootNode.separation(forwardNode);

    const combined = rootNode.combinedExtent(forwardNode, 0, separation);

    const expected = new Extent();
    expected.appendLS(12, separation + 6);
    expected.appendLS(38, 25);

    assert.ok(expected.equals(combined), "Combining extents does not work.");
  });

  it("Extent.equals", () => {
    const rootNode = new Extent();
    const forwardNode = new Extent();

    rootNode.appendLS(10, 10);
    rootNode.appendLS(10, NaN);
    rootNode.appendLS(10, 15);

    forwardNode.appendLS(10, 10);
    forwardNode.appendLS(10, NaN);
    forwardNode.appendLS(10, 15);

    assert.ok(rootNode.equals(forwardNode), "Equals does not handle NaN well.");
  });

  it("Extent.combinedExtent with NaN", () => {
    const rootNode = new Extent();
    const forwardNode = new Extent();

    rootNode.appendLS(50, 25);

    forwardNode.appendLS(10, NaN);
    forwardNode.setBoundSizeAt(0, NaN);
    assert.isNaN(forwardNode.boundSizeAt(0), "0");
    forwardNode.appendLS(30, 5);

    const separation = rootNode.separation(forwardNode);
    assert.equal(
      separation,
      30,
      "Separation doesn't even match. Actual=" + separation
    );

    const combined = rootNode.combinedExtent(forwardNode, 0, separation);

    const expected = new Extent();
    expected.appendLS(10, 25);
    expected.appendLS(30, 35);
    expected.appendLS(10, 25);

    assert.ok(expected.equals(combined), "Combining extents does not work.");
  });

  it("Extent.combinedExtent", () => {
    const rootNode = new Extent();
    const forwardNode = new Extent();

    rootNode.appendLS(50, 25);
    forwardNode.appendLS(12, 6);
    const separation = rootNode.separation(forwardNode);

    const combined = rootNode.combinedExtent(forwardNode, 25 - 6, separation);

    const expected = new Extent();
    expected.appendLS(19, 25);
    expected.appendLS(12, separation + 6);
    expected.appendLS(19, 25);

    assert.ok(expected.equals(combined), "Combining extents does not work.");
  });
});
