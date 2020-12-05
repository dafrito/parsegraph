/* eslint-disable require-jsdoc */

export function BufferPage(
    pagingBuffer,
    renderFunc,
    renderFuncThisArg) {
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

BufferPage.prototype.isEmpty = function() {
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
BufferPage.prototype.appendData = function(
    attribIndex, /* , ... */
) {
  // Ensure attribIndex points to a valid attribute.
  if (attribIndex < 0 || attribIndex > this.buffers.length - 1) {
    throw new Error('attribIndex is out of range. Given: ' + attribIndex);
  }
  if (typeof attribIndex !== 'number') {
    throw new Error('attribIndex must be a number.');
  }

  /**
   * Adds the specified value to the current vertex attribute buffer.
   */
  const pagingBuffer = this;
  const appendValue = function(value) {
    let numAdded = 0;
    if (typeof value.forEach == 'function') {
      value.forEach(function(x) {
        numAdded += appendValue.call(this, x);
      }, this);
      return numAdded;
    }
    if (typeof value.length == 'number') {
      for (let i = 0; i < value.length; ++i) {
        numAdded += appendValue.call(this, value[i]);
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
  for (let i = 1; i < args.length; ++i) {
    cumulativeAdded += appendValue.call(this, args[i]);
  }
  return cumulativeAdded;
};

BufferPage.prototype.appendRGB = function(attribIndex, color) {
  if (typeof color.r == 'function') {
    return this.appendData(attribIndex, color.r(), color.g(), color.b());
  }
  return this.appendData(attribIndex, color.r, color.g, color.b);
};

BufferPage.prototype.appendRGBA = function(attribIndex, color) {
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

/*
 * Manages the low-level paging of vertex attributes. For
 * demonstrations of use, see any painter class.
 */
export default function PagingBuffer(gl, program) {
  // Contains vertex attribute information used for drawing. Provide using
  // defineAttrib.
  this._attribs = [];

  // Contains buffer data for each page.
  this._pages = [];
  this._currentPage = -1;

  this._gl = gl;
  this._program = program;
}
export function createPagingBuffer(gl, program) {
  return new PagingBuffer(gl, program);
}

PagingBuffer.prototype.isEmpty = function() {
  // Check each page's buffer, failing early if possible.
  if (this._pages.length === 0) {
    return true;
  }
  for (let i = 0; i < this._pages.length; ++i) {
    if (this._pages[i].isEmpty()) {
      return true;
    }
  }
  return false;
};

PagingBuffer.prototype.addPage = function(
    renderFunc,
    renderFuncThisArg,
) {
  ++this._currentPage;

  if (this._currentPage < this._pages.length) {
    // Reuse the page.
    return;
  }

  // Create a new page.
  const page = new BufferPage(this, renderFunc, renderFuncThisArg);

  // Add the page.
  this._pages.push(page);
  page.id = this._pages.length - 1;

  // Return the working page.
  return page;
};

PagingBuffer.prototype.getWorkingPage = function() {
  if (this._pages.length === 0) {
    throw new Error('Refusing to create a new page; call addPage()');
  }
  return this._pages[this._currentPage];
};

/*
 * Defines an attribute for data entry.
 *
 * name - the attribute name in this paging buffer's GL program
 * numComponents - the number of components in the named attribute
 * type (1, 2, 3, or 4) drawMode - the WebGL draw mode.
 * Defaults to gl.STATIC_DRAW
 */
PagingBuffer.prototype.defineAttrib = function(
    name,
    numComponents,
    drawMode,
) {
  if (drawMode == undefined) {
    drawMode = this._gl.STATIC_DRAW;
  }
  // Add a new buffer entry for this new attribute.
  this._pages.forEach(function(page) {
    page.buffers.push([]);
    page.glBuffers.push(null);
  });

  const attrib = {
    name: name,
    numComponents: numComponents,
    drawMode: drawMode,
  };

  attrib.location = this._gl.getAttribLocation(this._program, attrib.name);

  this._attribs.push(attrib);

  return this._attribs.length - 1;
};

PagingBuffer.prototype.appendRGB = function(...args) {
  const page = this.getWorkingPage();
  return page.appendRGB.apply(page, ...args);
};

PagingBuffer.prototype.appendRGBA = function(...args) {
  const page = this.getWorkingPage();
  return page.appendRGBA.apply(page, ...args);
};

PagingBuffer.prototype.appendData = function(...args) {
  const page = this.getWorkingPage();
  return page.appendData.apply(page, ...args);
};

/*
 * Deletes all buffers and empties values.
 */
PagingBuffer.prototype.clear = function() {
  // Clear the buffers for all pages.
  this._pages.forEach(function(page) {
    this._attribs.forEach(function(attrib, attribIndex) {
      // if(page.glBuffers[attribIndex] != null) {
      // this._gl.deleteBuffer(page.glBuffers[attribIndex]);
      // page.glBuffers[attribIndex] = null;
      // }
      page.buffers[attribIndex] = [];
    }, this);
    page.needsUpdate = true;
  }, this);
  this._currentPage = -1;
};

/*
 * Render each page. This function sets up vertex attribute
 * buffers and calls drawArrays for each page.
 *
 * gl.drawArrays(gl.TRIANGLES, 0, numVertices)
 *
 * where numVertices is calculated from the appended data size / component
 * count. The least-filled buffer is used for the size, if the sizes differ.
 */
PagingBuffer.prototype.renderPages = function() {
  let count = 0;

  // Enable used vertex attributes.
  this._attribs.forEach(function(attrib) {
    if (attrib.location == -1) {
      return;
    }
    this._gl.enableVertexAttribArray(attrib.location);
  }, this);

  // Draw each page.
  this._pages.forEach(function(page, index) {
    if (index > this._currentPage) {
      return;
    }

    let numIndices;

    // Prepare each vertex attribute.
    this._attribs.forEach(function(attrib, attribIndex) {
      if (attrib.location == -1) {
        return;
      }
      // Bind the buffer, creating it if necessary.
      if (page.glBuffers[attribIndex] == null) {
        page.glBuffers[attribIndex] = this._gl.createBuffer();
      }
      this._gl.bindBuffer(this._gl.ARRAY_BUFFER, page.glBuffers[attribIndex]);

      // Load buffer data if the page needs an update.
      const bufferData = page.buffers[attribIndex];
      if (page.needsUpdate && bufferData.length > 0) {
        // console.log("Pushing bytes to GL");
        this._gl.bufferData(
            this._gl.ARRAY_BUFFER,
            new Float32Array(bufferData),
            attrib.drawMode,
        );
      }

      // Set up the vertex attribute pointer.
      this._gl.vertexAttribPointer(
          attrib.location,
          attrib.numComponents,
          this._gl.FLOAT,
          false,
          0,
          0,
      );

      const thisNumIndices = bufferData.length / attrib.numComponents;
      if (Math.round(thisNumIndices) != thisNumIndices) {
        throw new Error(
            'Odd number of indices for attrib ' +
            attrib.name +
            '. Wanted ' +
            Math.round(thisNumIndices) +
            ', but got ' +
            thisNumIndices,
        );
      }
      if (numIndices == undefined) {
        numIndices = thisNumIndices;
      } else {
        numIndices = Math.min(numIndices, thisNumIndices);
      }
    }, this);

    // Draw the page's triangles.
    if (numIndices > 0) {
      page.renderFunc.call(page.renderFuncThisArg, this._gl, numIndices);
      count += numIndices / 3;
    }

    page.needsUpdate = false;
  }, this);

  // Disable used variables.
  this._attribs.forEach(function(attrib) {
    if (attrib.location == -1) {
      return;
    }
    this._gl.disableVertexAttribArray(attrib.location);
  }, this);

  return count;
};
