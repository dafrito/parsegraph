import { Extent } from "./Extent";

export default class ExtentSeparator {
  _thisExtent: Extent;
  _givenExtent: Extent;
  _lengthAdjustment: number;
  _sizeAdjustment: number;
  _scale: number;
  thisBound: number;
  thisPosition: number;
  givenBound: number;
  givenPosition: number;

  constructor(
    thisExtent: Extent,
    givenExtent: Extent,
    lengthAdjustment: number,
    sizeAdjustment: number,
    scale: number
  ) {
    this._thisExtent = thisExtent;
    this._givenExtent = givenExtent;
    this._lengthAdjustment = lengthAdjustment;
    this._sizeAdjustment = sizeAdjustment;
    this._scale = scale;

    this.thisBound = 0;
    this.thisPosition = 0;
    this.givenBound = 0;
    this.givenPosition = 0;
  }

  // Returns this bound's size
  getThisSize(): number {
    if (this.thisBound >= this._thisExtent.numBounds()) {
      throw new Error(
        "Getting this bound's size past the " + "end of this extent."
      );
    }
    return this._thisExtent.boundSizeAt(this.thisBound);
  }

  // Returns given's bound's size
  getGivenSize(): number {
    if (this.givenBound >= this._givenExtent.numBounds()) {
      throw new Error(
        "Getting given's size past the end of " + "given's extent."
      );
    }
    const rv = this._givenExtent.boundSizeAt(this.givenBound);
    if (isNaN(rv)) {
      return NaN;
    }
    return this._scale * rv + this._sizeAdjustment;
  }

  // Moves to this extent's next bound. true is returned as long as
  // thisBound is valid.
  getThisNextBound(): boolean {
    if (this.thisBound >= this._thisExtent.numBounds()) {
      throw new Error("Getting past end of this extent.");
    }
    this.thisPosition += this._thisExtent.boundLengthAt(this.thisBound);
    ++this.thisBound;
    return this.thisBound != this._thisExtent.numBounds();
  }

  // Increments given's iterator. true is returned as long as givenBound
  // is valid.
  getGivenNextBound(): boolean {
    if (this.givenBound >= this._givenExtent.numBounds()) {
      throw new Error("Getting past end of given bound.");
    }
    this.givenPosition +=
      this._scale * this._givenExtent.boundLengthAt(this.givenBound);
    ++this.givenBound;
    return this.givenBound != this._givenExtent.numBounds();
  }

  givenReach(): number {
    if (this.givenBound >= this._givenExtent.numBounds()) {
      return this.givenPosition;
    }
    return (
      this.givenPosition +
      this._scale * this._givenExtent.boundLengthAt(this.givenBound)
    );
  }

  thisReach() {
    if (this.thisBound == this._thisExtent.numBounds()) {
      return this.thisPosition;
    }
    return this.thisPosition + this._thisExtent.boundLengthAt(this.thisBound);
  }

  combine(): Extent {
    // Create the aggregate result.
    const result = new Extent();

    // Iterate over each bound.
    // let combinedIteration = 0;
    while (
      this.givenBound != this._givenExtent.numBounds() &&
      this.thisBound != this._thisExtent.numBounds()
    ) {
      // console.log("Iterating over each bound.");
      // console.log("This reach: " + thisReach.call(this) + ", size: " + getThisSize.call(this) + ", pos: " + thisPosition);
      // console.log("Given reach: " + givenReach.call(this) + ", size: " + getGivenSize.call(this) + ", pos: " + givenPosition);
      // ++combinedIteration;
      const thisSize = this.getThisSize();
      const givenSize = this.getGivenSize();

      let newSize;
      if (!isNaN(thisSize) && !isNaN(givenSize)) {
        newSize = Math.max(thisSize, givenSize);
      } else if (!isNaN(thisSize)) {
        newSize = thisSize;
      } else {
        newSize = givenSize;
      }

      result.appendLS(
        Math.min(this.thisReach(), this.givenReach()) -
          Math.max(this.thisPosition, this.givenPosition),
        newSize
      );

      if (this.thisReach() == this.givenReach()) {
        // This bound ends at the same position as given's
        // bound, so increment both iterators.
        this.getThisNextBound();
        this.getGivenNextBound();
      } else if (this.thisReach() < this.givenReach()) {
        // This bound ends before given's bound, so increment
        // this bound's iterator.
        this.getThisNextBound();
      } else {
        // Assert: thisReach() > givenReach()
        // Given's bound ends before this bound, so increment
        // given's iterator.
        this.getGivenNextBound();
      }
    }

    if (this.givenBound != this._givenExtent.numBounds()) {
      // Finish off given last overlapping bound to get completely
      // in sync with givens.
      result.appendLS(
        this.givenReach() - this.thisReach(),
        this.getGivenSize()
      );
      while (this.getGivenNextBound()) {
        // ++combinedIteration;
        result.appendLS(
          this._scale * this._givenExtent.boundLengthAt(this.givenBound),
          this.getGivenSize()
        );
      }
    } else if (this.thisBound != this._thisExtent.numBounds()) {
      // Finish off this extent's last overlapping bound to get completely
      // in sync with given's iterator.
      result.appendLS(this.thisReach() - this.givenReach(), this.getThisSize());
      while (this.getThisNextBound()) {
        // ++combinedIteration;
        result.appendLS(
          this._thisExtent.boundLengthAt(this.thisBound),
          this.getThisSize()
        );
      }
    }
    // console.log("Combined after " + combinedIteration + "iterations");
    return result;
  }
}
