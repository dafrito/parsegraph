/* eslint-disable require-jsdoc */

import BufferPage from './BufferPage';

/*
 * Manages the low-level paging of vertex attributes. For
 * demonstrations of use, see any painter class.
 */
export default class PagingBuffer {
  constructor(gl, program) {
    if (!gl) {
      throw new Error('gl must be provided');
    }
    if (!program) {
      throw new Error('program must be provided');
    }
    // Contains vertex attribute information used for drawing. Provide using
    // defineAttrib.
    this._attribs = [];

    // Contains buffer data for each page.
    this._pages = [];
    this._currentPage = -1;

    this._gl = gl;
    this._program = program;
  }

  isEmpty() {
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

  addPage(
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

  getWorkingPage() {
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
  defineAttrib(
      name,
      numComponents,
      drawMode?
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

  appendRGB(...args) {
    const page = this.getWorkingPage();
    return page.appendRGB(...args);
  };

  appendRGBA(...args) {
    const page = this.getWorkingPage();
    return page.appendRGBA(...args);
  };

  appendData(...args) {
    const page = this.getWorkingPage();
    return page.appendData(...args);
  };

  /*
   * Deletes all buffers and empties values.
   */
  clear() {
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
  renderPages() {
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
  }
}

export function createPagingBuffer(gl, program) {
  return new PagingBuffer(gl, program);
}
