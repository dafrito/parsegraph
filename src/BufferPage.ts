/* eslint-disable require-jsdoc */

export default class BufferPage {
  constructor(
      pagingBuffer,
      renderFunc,
      renderFuncThisArg,
  ) {
    if (!renderFuncThisArg) {
      renderFuncThisArg = this;
    }
    if (!renderFunc) {
      renderFunc = function(gl, numIndices) {
        // console.log("Drawing " + numIndices + " indices");
        gl.drawArrays(gl.TRIANGLES, 0, numIndices);
      };
    }

    this.buffers = [];
    this.glBuffers = [];
    this.needsUpdate = true;
    this.renderFunc = renderFunc;
    this.renderFuncThisArg = renderFuncThisArg;

    // Add a buffer entry for each vertex attribute.
    pagingBuffer._attribs.forEach(function() {
      this.buffers.push([]);
      this.glBuffers.push(null);
    }, this);
  }

  isEmpty() {
    if (this.buffers.length === 0) {
      return true;
    }
    for (let j = 0; j < this.buffers.length; ++j) {
      const buffer = this.buffers[j];
      if (buffer.length === 0) {
        return true;
      }
    }
    return false;
  };

  /*
   * appendData(attribIndex, value1, value2, ...);
   * appendData(attribIndex, valueArray);
   *
   * Adds each of the specified values to the working buffer. If the value is an
   * array, each of its internal values are added.
   */
  appendData(attribIndex, ...args) {
    // Ensure attribIndex points to a valid attribute.
    if (attribIndex < 0 || attribIndex > this.buffers.length - 1) {
      throw new Error('attribIndex is out of range. Given: ' + attribIndex);
    }
    if (typeof attribIndex !== 'number') {
      throw new Error('attribIndex must be a number.');
    }

    /**
     * Adds the specified value to the current vertex attribute buffer.
     * @param {Function|Array|number} value either a function, Array, or number.
     * @return {number} the number of added values
     */
    const appendValue = (value)=>{
      let numAdded = 0;
      if (typeof value.forEach == 'function') {
        value.forEach(function(x) {
          numAdded += appendValue(x);
        }, this);
        return numAdded;
      }
      if (typeof value.length == 'number') {
        for (let i = 0; i < value.length; ++i) {
          numAdded += appendValue(value[i]);
        }
        return numAdded;
      }
      if (Number.isNaN(value) || typeof value != 'number') {
        throw new Error('Value is not a number: ' + value);
      }
      this.buffers[attribIndex].push(value);
      this.needsUpdate = true;

      return 1;
    };

    // Add each argument individually.
    let cumulativeAdded = 0;
    for (let i = 0; i < args.length; ++i) {
      cumulativeAdded += appendValue(args[i]);
    }
    return cumulativeAdded;
  };

  appendRGB(attribIndex, color) {
    if (typeof color.r == 'function') {
      return this.appendData(attribIndex, color.r(), color.g(), color.b());
    }
    return this.appendData(attribIndex, color.r, color.g, color.b);
  };

  appendRGBA(attribIndex, color) {
    if (typeof color.r == 'function') {
      return this.appendData(
          attribIndex,
          color.r(),
          color.g(),
          color.b(),
          color.a(),
      );
    }
    return this.appendData(attribIndex, color.r, color.g, color.b, color.a);
  };
}

