var assert = require("assert");
import TestSuite from "../dist/testsuite";

describe("TestSuite", function () {
  describe("#constructor()", function () {
    it("works", ()=>{
      assert.ok(new parsegraph_TestSuite('Default', false));
    });
    it("also works", ()=>{
      assert.ok(new parsegraph_TestSuite('Default', false));
    });
  });
});
