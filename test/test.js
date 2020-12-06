var assert = require("assert");
import getTimeInMillis from "../dist/gettimeinmillis";

describe("getTimeInMillis", function () {
  it("works", ()=>{
    assert.ok(!isNaN(getTimeInMillis()));
  });
});
