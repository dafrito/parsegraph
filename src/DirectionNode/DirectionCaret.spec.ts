import { assert } from "chai";
import { DirectionCaret } from "../../src/DirectionCaret";

describe("Caret", function () {
  it("can use a ", () => {
    const car = new DirectionCaret("a");
    assert.equal("a", car.node().value());
    car.spawnMove("f", "b");
    assert.equal("b", car.node().value());
  });

  it("moveToParent", () => {
    const car = new DirectionCaret("root");
    car.spawnMove("f", "b");
    car.moveToParent();
    assert.equal(car.value(), "root");
  });
});
