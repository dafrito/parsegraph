import { assert } from "chai";
import { DirectionCaret } from "../../src/src/index";

describe("Caret", function () {
  it("can use a ", () => {
    const car = new DirectionCaret("a");
    assert.equal("a", car.node().value());
    car.spawnMove("f", "b");
    assert.equal("b", car.node().value());
  });
});
