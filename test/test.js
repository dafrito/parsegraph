var assert = require("assert");
import todo from "../dist/layout";

describe("Package", function () {
  it("works", ()=>{
    assert.equal(todo(), 42);
  });
});
