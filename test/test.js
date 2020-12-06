var assert = require("assert");
import PagingBuffer, { BufferPage } from "../dist/pagingbuffer";
console.log(PagingBuffer);
console.log(BufferPage);

require("webgl-mock");

describe("Array", function () {
  describe("#indexOf()", function () {
    it("should return -1 when the value is not present", function () {
      assert.equal([1, 2, 3].indexOf(4), -1);
    });
  });
});

describe("PagingBuffer", function () {
  describe("#constructor()", function () {
    it("should return a PagingBuffer", function () {
      var canvas = new HTMLCanvasElement(500, 500);
      var gl = canvas.getContext("webgl");
      const pb = new PagingBuffer(gl, 1);
      assert.ok(pb, "PagingBuffer constructor must return a truthy value");
      assert.deepStrictEqual(
        pb.isEmpty(),
        true,
        "PagingBuffer must begin empty"
      );
      pb.addPage(() => {}, pb);
      assert.deepStrictEqual(pb.isEmpty(), true, "PagingBuffer remais empty");
    });
    it("should throw on falsy GL", function () {
      var canvas = new HTMLCanvasElement(500, 500);
      var gl = canvas.getContext("webgl");
      assert.throws(() => {
        new PagingBuffer(null, 1);
      });
    });
    it("should throw on falsy program", function () {
      var canvas = new HTMLCanvasElement(500, 500);
      var gl = canvas.getContext("webgl");
      assert.throws(() => {
        new PagingBuffer(gl, null);
      });
    });
  });
  describe("#appendData()", function () {
    it("works for values", function () {
      var canvas = new HTMLCanvasElement(500, 500);
      var gl = canvas.getContext("webgl");
      var pb = new PagingBuffer(gl, 1);
      pb.addPage(() => {}, null);
      const a_position = pb.defineAttrib("a_position", 3);
      pb.appendData(a_position, 1, 0, 0);
      pb.appendData(a_position, 0, 1, 0);
      pb.appendData(a_position, 0, 0, 1);
    });
    it("fails if given falsy attribute index", function () {
      var canvas = new HTMLCanvasElement(500, 500);
      var gl = canvas.getContext("webgl");
      var pb = new PagingBuffer(gl, 1);
      pb.addPage(() => {}, null);
      const a_position = pb.defineAttrib("a_position", 3);
      pb.appendData(a_position, 1, 0, 0);
      assert.throws(() => {
        pb.appendData(null, 0, 1, 0);
      });
      pb.appendData(a_position, 0, 0, 1);
    });
  });
});
