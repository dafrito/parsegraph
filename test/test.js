var assert = require("assert");
import todo from "../dist/TODO-PACKAGE-NAME";

describe("Package", function () {
  it("works", ()=>{
    assert.equal(todo(), 42);
  });
});
