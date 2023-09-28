const { assert } = require("chai");
import Rect from "../src/rect";

describe("Package", function () {
  it("vMin", function () {
    const r = new Rect(0, 0, 200, 200);
    assert.equal(r.vMin(), -100, "vMin");
  });

  it("vMax", function () {
    const r = new Rect(0, 0, 200, 200);
    assert.equal(r.vMax(), 100, "vMax");
  });

  it("hMin", function () {
    const r = new Rect(0, 0, 300, 200);
    assert.equal(r.hMin(), -150, "vMin");
  });

  it("hMax", function () {
    const r = new Rect(0, 0, 300, 200);
    assert.equal(r.hMax(), 150, "hMax");
  });

  it("include", function () {
    const r = new Rect(0, 0, 200, 200);
    r.include(0, 400, 200, 200);

    assert.equal(
      r.vMax(),
      new Rect(0, 400, 200, 200).vMax(),
      "vMax must adjust on include"
    );
  });

  it("include nan", function () {
    const r = new Rect();
    r.include(0, 400, 200, 300);
    assert.equal(r.x(), 0, "x");
    assert.equal(r.y(), 400, "y");
    assert.equal(r.width(), 200, "width");
    assert.equal(r.height(), 300, "height");
  });
});
