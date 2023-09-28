const assert = require("assert");
import Size from "../src/size";

describe("Size", function () {
  it("works", () => {
    const s = new Size(1, 2);
    assert.equal(s.width(), 1);
    assert.equal(s.height(), 2);
    s.scale(2);
    assert.equal(s.width(), 2);
    assert.equal(s.height(), 4);
    s.clear();
    assert.equal(s.width(), 0);
    assert.equal(s.height(), 0);
  });

  it("works without an argument", () => {
    const s = new Size();
    assert.equal(s.width(), 0);
    assert.equal(s.height(), 0);
    s.scale(2);
    assert.equal(s.width(), 0);
    assert.equal(s.height(), 0);
  });
});
