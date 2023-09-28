import assert from "assert";
import generateID from "../src/generateid";

describe("generateID", function () {
  it("generates a unique ID", function () {
    assert.ok(generateID() != generateID());
  });
});
