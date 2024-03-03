import { Extent } from "./Extent";

export default class ExtentSeparator {
  _thisExtent: Extent;
  _givenExtent: Extent;
  _thisBound: number;
  _givenBound: number;
  _thisPosition: number;
  _positionAdjustment: number;
  _allowAxisOverlap: boolean;
  _givenScale: number;
  _givenPosition: number;

  constructor(
    thisExtent: Extent,
    givenExtent: Extent,
    positionAdjustment: number,
    allowAxisOverlap: boolean,
    givenScale: number
  ) {
    this._thisExtent = thisExtent;
    this._givenExtent = givenExtent;
    this._thisBound = 0;
    this._givenBound = 0;

    this._thisPosition = 0;

    this._positionAdjustment = positionAdjustment;
    this._allowAxisOverlap = allowAxisOverlap;
    this._givenScale = givenScale;

    // The position of given. This is in this node's space.
    this._givenPosition = 0;
  }

  /*
   * Moves the iterator for this extent to its next bound.
   *
   * The iterator is just a fancy counter. Both the position
   * and the bound index are tracked.
   */
  incrementThisBound(): void {
    this._thisPosition += this._thisExtent.boundLengthAt(this._thisBound);
    ++this._thisBound;
  }

  givenBoundLength(): number {
    return this._givenScale * this._givenExtent.boundLengthAt(this._givenBound);
  }

  givenBoundSize(): number {
    const rv = this._givenExtent.boundSizeAt(this._givenBound);
    if (isNaN(rv)) {
      return rv;
    }
    return this._givenScale * rv;
  }

  thisBoundSize(): number {
    return this._thisExtent.boundSizeAt(this._thisBound);
  }

  /*
   * Moves the iterator for the given extent to the next bound.
   *
   * The iterator is just a fancy counter. Both the position
   * and the bound index are tracked.
   */
  incrementGivenBound(): void {
    this._givenPosition += this.givenBoundLength();
    ++this._givenBound;
  }

  givenAtEnd(): boolean {
    return this._givenBound == this._givenExtent.numBounds();
  }

  thisAtEnd(): boolean {
    return this._thisBound == this._thisExtent.numBounds();
  }

  consume(extentSeparation: number): number {
    // While the iterators still have bounds in both extents.
    while (!this.givenAtEnd() && !this.thisAtEnd()) {
      // Calculate the separation between these bounds.
      // console.log("Separating");
      // console.log("This bound size: " + this.boundSizeAt(this._thisBound));
      // console.log("Given bound size: " + this.givenBoundSize());
      const thisSize = this._thisExtent.boundSizeAt(this._thisBound);
      const givenSize = this.givenBoundSize();
      let boundSeparation;
      if (!isNaN(thisSize) && !isNaN(givenSize)) {
        boundSeparation = thisSize + givenSize;
      } else if (!this._allowAxisOverlap) {
        if (!isNaN(thisSize)) {
          boundSeparation = thisSize;
        } else if (!isNaN(givenSize)) {
          boundSeparation = givenSize;
        } else {
          // Both extents are empty at this location.
          boundSeparation = 0;
        }
      } else {
        // Axis overlap is allowed.
        boundSeparation = 0;
      }
      if (boundSeparation > extentSeparation) {
        extentSeparation = boundSeparation;
        // console.log("Found new separation of " + extentSeparation + ".");
      }

      // Increment the iterators to the next testing point.

      // endComparison is a difference that indicates which bound
      // ends soonest.
      const endComparison =
        this._thisPosition +
        this._thisExtent.boundLengthAt(this._thisBound) -
        this._positionAdjustment -
        (this._givenPosition +
          this._givenScale * this._givenExtent.boundLengthAt(this._givenBound));

      if (endComparison == 0) {
        // This bound ends at the same position as given's bound,
        // so increment both.

        this.incrementGivenBound();
        this.incrementThisBound();
      } else if (endComparison > 0) {
        // This bound ends after given's bound, so increment the
        // given bound's iterator.
        this.incrementGivenBound();
      }
      if (endComparison < 0) {
        // Given's bound ends after this bound, so increment this
        // bound's iterator.
        this.incrementThisBound();
      }
    }
    return extentSeparation;
  }
}
