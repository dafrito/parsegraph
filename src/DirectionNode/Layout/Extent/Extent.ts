import fuzzyEquals from "./fuzzyequals";
import ExtentSeparator from "./ExtentSeparator";
import ExtentCombiner from "./ExtentCombiner";

const DEFAULT_EXTENT_BOUNDS = 1;
const NUM_EXTENT_BOUND_COMPONENTS = 2;
const SEPARATION_TIMEOUT = 100000;

export class Extent {
  private _offset: number;
  private _numBounds: number;
  private _bounds: Float32Array;
  private _start: number;

  private _minSize: number;
  private _maxSize: number;
  private _totalLength: number;

  constructor(copy?: Extent) {
    if (copy !== undefined && copy._bounds) {
      this._offset = copy._offset;
      this._numBounds = copy._numBounds;
      this._bounds = new Float32Array(copy._bounds);
      this._start = copy._start;
      if (!isNaN(copy._minSize)) {
        this._minSize = copy._minSize;
        this._maxSize = copy._maxSize;
        this._totalLength = copy._totalLength;
      }
    } else {
      this._start = 0;
      this._offset = 0;
      this._numBounds = 0;
      this._bounds = new Float32Array();
      this._minSize = NaN;
      this._maxSize = NaN;
      this._totalLength = NaN;
    }
  }

  setOffset(offset: number) {
    this._offset = offset;
  }

  offset(): number {
    return this._offset;
  }

  forEach(func: (length: number, size: number, index: number) => void): void {
    for (let i = 0; i < this._numBounds; ++i) {
      func(this.boundLengthAt(i), this.boundSizeAt(i), i);
    }
  }

  clone(): Extent {
    return new Extent(this);
  }

  clear(): void {
    this._numBounds = 0;
    this.invalidateBoundingValues();
  }

  numBounds(): number {
    return this._numBounds;
  }

  hasBounds(): boolean {
    return this.numBounds() > 0;
  }

  boundLengthAt(index: number): number {
    return this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
        ((this._start + index) % this.boundCapacity())
    ];
  }

  boundSizeAt(index: number): number {
    return this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
        ((this._start + index) % this.boundCapacity()) +
        1
    ];
  }

  invalidateBoundingValues(): void {
    this._minSize = NaN;
    this._maxSize = NaN;
    this._totalLength = NaN;
  }

  setBoundLengthAt(index: number, length: number): void {
    this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
        ((this._start + index) % this.boundCapacity())
    ] = length;
    this.invalidateBoundingValues();
  }

  setBoundSizeAt(index: number, size: number): void {
    this._bounds[
      NUM_EXTENT_BOUND_COMPONENTS *
        ((this._start + index) % this.boundCapacity()) +
        1
    ] = size;
    this.invalidateBoundingValues();
  }

  realloc(capacity: number): number {
    if (capacity < DEFAULT_EXTENT_BOUNDS) {
      capacity = DEFAULT_EXTENT_BOUNDS;
    }
    const oldBounds = this._bounds;
    const oldCap = this.boundCapacity();
    if (oldCap >= capacity) {
      // TODO This could shrink.
      throw new Error("Cannot shrink Extent capacity");
    }

    // Change the capacity.
    this._bounds = new Float32Array(NUM_EXTENT_BOUND_COMPONENTS * capacity);

    if (oldBounds) {
      if (this._start + this._numBounds > oldCap) {
        const frontBounds = this._start + this._numBounds - oldCap;
        // TODO See if this can be copied more efficiently, and if that matters.
        for (
          let i = 0;
          i < NUM_EXTENT_BOUND_COMPONENTS * (this._numBounds - frontBounds);
          ++i
        ) {
          this._bounds[i] = oldBounds[this._start + i];
        }
        for (
          let i = 0;
          i < NUM_EXTENT_BOUND_COMPONENTS * (this._numBounds - frontBounds);
          ++i
        ) {
          this._bounds[this._numBounds - frontBounds + i] = oldBounds[i];
        }
      } else {
        // Can do it in a single copy.
        for (
          let i = 0;
          i < NUM_EXTENT_BOUND_COMPONENTS * this._numBounds;
          ++i
        ) {
          this._bounds[i] = oldBounds[this._start + i];
        }
      }
      // console.log(oldBounds, "to", this._bounds);
    }

    this._start = 0;

    return 0;
  }

  prependLS(length: number, size: number): void {
    if (isNaN(length)) {
      throw new Error("Length must not be NaN");
    }
    if (length == 0) {
      // Drop empty lengths.
      return;
    }
    // Do not allow negative length values.
    if (length < 0) {
      const str =
        "Non-positive bound lengths are not allowed, but " +
        length +
        " was given anyway.";
      throw new Error(str);
    }

    if (this.numBounds() > 0) {
      const frontSize = this.boundSizeAt(0);
      if (
        (Number.isNaN(frontSize) && Number.isNaN(size)) ||
        frontSize === size
      ) {
        // Extent the first bound.
        this.setBoundLengthAt(0, this.boundLengthAt(0) + length);
        return;
      }
    }

    if (this.boundCapacity() == this.numBounds()) {
      // Completely full, so expand.
      let newCap = DEFAULT_EXTENT_BOUNDS;
      if (this.boundCapacity() > 0) {
        newCap = 2 * this.boundCapacity();
      }
      this.realloc(newCap);
    }

    if (this._start == 0) {
      this._start = this.boundCapacity() - 1;
    } else {
      --this._start;
    }

    ++this._numBounds;
    this.setBoundLengthAt(0, length);
    this.setBoundSizeAt(0, size);
  }

  boundCapacity(): number {
    if (!this._bounds) {
      return 0;
    }
    return this._bounds.length / NUM_EXTENT_BOUND_COMPONENTS;
  }

  appendLS(length: number, size: number): void {
    if (isNaN(length)) {
      throw new Error("Length must not be NaN");
    }
    if (length === 0) {
      // Drop empty lengths.
      return;
    }
    if (length < 0) {
      const str =
        "Non-positive bound lengths are not allowed, but " +
        length +
        " was given anyway.";
      throw new Error(str);
    }

    if (this.numBounds() > 0) {
      const lastSize = this.boundSizeAt(this.numBounds() - 1);
      if ((isNaN(lastSize) && isNaN(size)) || lastSize === size) {
        this.setBoundLengthAt(
          this.numBounds() - 1,
          this.boundLengthAt(this.numBounds() - 1) + length
        );
        return;
      }
    }

    if (this.boundCapacity() == this.numBounds()) {
      // Completely full, so expand.
      let newCap = DEFAULT_EXTENT_BOUNDS;
      if (this.boundCapacity() > 0) {
        newCap = 2 * this.boundCapacity();
      }
      this.realloc(newCap);
    }

    ++this._numBounds;
    this.setBoundLengthAt(this.numBounds() - 1, length);
    this.setBoundSizeAt(this.numBounds() - 1, size);
  }

  prependSL(size: number, length: number): void {
    this.prependLS(length, size);
  }

  appendSL(size: number, length: number): void {
    this.appendLS(length, size);
  }

  adjustSize(adjustment: number): void {
    // Adjust the size of each bound.
    for (let i = 0; i < this.numBounds(); ++i) {
      const size = this.boundSizeAt(i);
      // Ignore empty sizes.
      if (!isNaN(size)) {
        this.setBoundSizeAt(i, size + adjustment);
      }
    }
  }

  simplify(): void {
    let totalLength = 0;
    let maxSize = NaN;
    for (let i = 0; i < this.numBounds(); ++i) {
      totalLength += this.boundLengthAt(i);

      const size = this.boundSizeAt(i);
      if (isNaN(maxSize)) {
        maxSize = size;
      } else if (!isNaN(size)) {
        maxSize = Math.max(maxSize, size);
      }
    }
    this.clear();
    this.appendLS(totalLength, maxSize);
  }

  sizeAt(offset: number): number {
    // Do not allow negative offsets.
    if (offset < 0) {
      throw new Error("Negative offsets are not supported");
    }

    // Determine the bound at the given offset.
    let pos = 0;
    let i = 0;
    while (i < this.numBounds()) {
      const thisBoundLength = this.boundLengthAt(i);
      if (offset <= pos + thisBoundLength) {
        break;
      }
      pos += thisBoundLength;
      ++i;
    }
    // Return NaN if the offset is beyond the full size of this extent.
    if (i == this.numBounds()) {
      return NaN;
    }

    // Return the size at the determined bound.
    return this.boundSizeAt(i);
  }

  combineBound(
    newBoundStart: number,
    newBoundLength: number,
    newBoundSize: number
  ): void {
    // Create the extent to be merged.
    const added = new Extent();
    added.appendLS(newBoundLength, newBoundSize);

    // Copy the combined result into this extent.
    this.copyFrom(this.combinedExtent(added, newBoundStart));
  }

  copyFrom(from: Extent): void {
    this._numBounds = from._numBounds;
    this._bounds = from._bounds;
    from.clear();
    this.invalidateBoundingValues();
  }

  combineExtentAndSimplify(
    given: Extent,
    lengthAdjustment: number,
    sizeAdjustment: number,
    scale: number,
    bv: number[]
  ): void {
    given.boundingValues(bv);
    const givenLength = bv[0];
    const givenMaxSize = bv[2];
    this.boundingValues(bv);
    const thisLength = bv[0];
    const thisMaxSize = bv[2];
    this.clear();
    let combinedLength;
    if (lengthAdjustment < 0) {
      combinedLength = Math.max(
        thisLength - lengthAdjustment,
        givenLength * scale
      );
    } else {
      combinedLength = Math.max(
        thisLength,
        givenLength * scale + lengthAdjustment
      );
    }
    this.appendLS(
      combinedLength,
      Math.max(thisMaxSize, givenMaxSize * scale + sizeAdjustment)
    );
  }

  combineExtent(
    given: Extent,
    lengthAdjustment: number,
    sizeAdjustment: number,
    scale: number
  ): void {
    // Combine the extent into this one, creating a new extent in the process.
    const result = this.combinedExtent(
      given,
      lengthAdjustment,
      sizeAdjustment,
      scale
    );

    // Copy the combined result into this extent.
    this.copyFrom(result);
  }

  combinedExtent(
    given: Extent,
    lengthAdjustment?: number,
    sizeAdjustment?: number,
    scale?: number
  ): Extent {
    if (lengthAdjustment === undefined) {
      lengthAdjustment = 0;
    }
    if (sizeAdjustment === undefined) {
      sizeAdjustment = 0;
    }
    if (scale === undefined) {
      scale = 1.0;
    }
    if (lengthAdjustment < 0) {
      const result = given.combinedExtent(
        this,
        -lengthAdjustment / scale,
        -sizeAdjustment / scale,
        1 / scale
      );
      result.scale(scale);
      result.adjustSize(sizeAdjustment);
      return result;
    } else if (lengthAdjustment > 0) {
      // We have a length adjustment.
      const givenCopy = given.clone();
      givenCopy.prependLS(lengthAdjustment / scale, NaN);
      return this.combinedExtent(givenCopy, 0, sizeAdjustment, scale);
    }

    return new ExtentCombiner(
      this,
      given,
      lengthAdjustment,
      sizeAdjustment,
      scale
    ).combine();
  }

  scale(factor: number): void {
    this.forEach((length: number, size: number, i: number) => {
      this.setBoundLengthAt(i, length * factor);
      if (!isNaN(this.boundSizeAt(i))) {
        this.setBoundSizeAt(i, size * factor);
      }
    });
  }

  separation(
    given: Extent,
    positionAdjustment?: number,
    allowAxisOverlap?: boolean,
    givenScale?: number
  ): number {
    if (positionAdjustment === undefined) {
      positionAdjustment = 0;
    }
    if (allowAxisOverlap === undefined) {
      allowAxisOverlap = true;
    }
    if (givenScale === undefined) {
      givenScale = 1.0;
    }
    // console.log("Separation(positionAdjustment=" + positionAdjustment + ")");

    const separator = new ExtentSeparator(
      this,
      given,
      positionAdjustment,
      allowAxisOverlap,
      givenScale
    );

    // extentSeparation is the minimum distance to separate this extent
    // from the given extent, so that they do not overlap if facing one
    // another.
    let extentSeparation = 0;

    // Adjust this extent's iterator to account for the position adjustment.
    if (positionAdjustment < 0) {
      while (
        !separator.givenAtEnd() &&
        separator._givenPosition + separator.givenBoundLength() <=
          -positionAdjustment
      ) {
        // If we don't allow axis overlap, then be sure to include these bounds
        // that are being skipped.
        const boundSeparation = separator.givenBoundSize();
        if (
          !allowAxisOverlap &&
          !isNaN(boundSeparation) &&
          boundSeparation > extentSeparation
        ) {
          extentSeparation = boundSeparation;
        }
        separator.incrementGivenBound();
      }
    } else {
      // Positive positionAdjustment.
      while (
        !separator.thisAtEnd() &&
        separator._thisPosition + this.boundLengthAt(separator._thisBound) <=
          positionAdjustment
      ) {
        const boundSeparation = separator.thisBoundSize();
        if (
          !allowAxisOverlap &&
          !isNaN(boundSeparation) &&
          boundSeparation > extentSeparation
        ) {
          extentSeparation = boundSeparation;
        }
        separator.incrementThisBound();
      }
    }

    extentSeparation = separator.consume(extentSeparation);

    if (!allowAxisOverlap) {
      // Calculate the separation between the remaining bounds of given and
      // the separation boundary.
      let count = 0;
      while (!separator.givenAtEnd()) {
        if (count++ > SEPARATION_TIMEOUT) {
          throw new Error("Extent separation timed out");
        }

        const givenSize = given.boundSizeAt(separator._givenBound);
        if (!isNaN(givenSize)) {
          extentSeparation = Math.max(extentSeparation, givenScale * givenSize);
        }
        ++separator._givenBound;
      }
    }

    return extentSeparation;
  }

  boundingValues(outVal?: number[]): number[] {
    if (!outVal) {
      outVal = [NaN, NaN, NaN];
    }
    if (!isNaN(this._minSize)) {
      outVal[0] = this._totalLength;
      outVal[1] = this._minSize;
      outVal[2] = this._maxSize;
      return outVal;
    }
    let totalLength = 0;
    let minSize = NaN;
    let maxSize = NaN;

    for (let iter = 0; iter != this.numBounds(); ++iter) {
      totalLength += this.boundLengthAt(iter);

      const size = this.boundSizeAt(iter);
      if (isNaN(minSize)) {
        minSize = size;
      } else if (!isNaN(size)) {
        minSize = Math.min(minSize, size);
      }

      if (isNaN(maxSize)) {
        maxSize = size;
      } else if (!isNaN(size)) {
        maxSize = Math.max(maxSize, size);
      }
    }

    outVal[0] = totalLength;
    outVal[1] = minSize;
    outVal[2] = maxSize;
    this._minSize = minSize;
    this._maxSize = maxSize;
    this._totalLength = totalLength;
    return outVal;
  }

  equals(other: Extent, fuzziness?: number): boolean {
    // Exit quickly if we are comparing with ourselves.
    if (this === other) {
      return true;
    }

    // Ensure the sizes match.
    if (!other || this.numBounds() != other.numBounds()) {
      return false;
    }

    // Compare the bounds for equality.
    for (let i = 0; i < this.numBounds(); ++i) {
      if (
        !fuzzyEquals(this.boundLengthAt(i), other.boundLengthAt(i), fuzziness)
      ) {
        return false;
      }
      const thisSize = this.boundSizeAt(i);
      const otherSize = other.boundSizeAt(i);
      if (isNaN(thisSize) && isNaN(otherSize)) {
        // Both NaN.
        continue;
      }
      // Fail if one is NaN and the other is not.
      if (isNaN(thisSize) || isNaN(otherSize)) {
        return false;
      }
      if (!fuzzyEquals(this.boundSizeAt(i), other.boundSizeAt(i))) {
        return false;
      }
    }
    return true;
  }

  dump(message: any): void {
    if (message !== undefined) {
      console.log(message);
    }

    let offset = 0;
    for (let i = 0; i < this.numBounds(); ++i) {
      console.log(
        "" +
          offset +
          ": [length=" +
          this.boundLengthAt(i) +
          ", size=" +
          this.boundSizeAt(i) +
          "]"
      );
      offset += this.boundLengthAt(i);
    }
  }
}
