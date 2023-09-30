let sizeCount: number = 0;
export default class Size {
  id: number;
  length: number;
  "0": number;
  "1": number;

  constructor(w?: number, h?: number) {
    this.id = sizeCount++;
    if (arguments.length > 0) {
      this[0] = w;
      this[1] = h;
    } else {
      this[0] = 0;
      this[1] = 0;
    }
    this.length = 2;
  }

  copyFrom(other: Size) {
    this[0] = other[0];
    this[1] = other[1];
  }

  copyTo(other: Size) {
    other[0] = this[0];
    other[1] = this[1];
  }

  clone() {
    return new Size(this[0], this[1]);
  }

  nonzero() {
    return !this.zero();
  }

  zero() {
    return this.width() === 0 && this.height() === 0;
  }

  clear(): void {
    this[0] = 0;
    this[1] = 0;
  }

  reset(): void {
    this.clear();
  }

  scale(factor: number): void {
    this[0] *= factor;
    this[1] *= factor;
  }

  scaled(factor: number): Size {
    return new Size(this[0] * factor, this[1] * factor);
  }

  width(): number {
    return this[0];
  }

  setWidth(width: number): void {
    this[0] = width;
  }

  setSize(w: number, h: number) {
    this[0] = w;
    this[1] = h;
  }

  height(): number {
    return this[1];
  }

  setHeight(height: number): void {
    this[1] = height;
  }

  toString(): string {
    return "[w=" + this.width() + ", h=" + this.height() + "]";
  }
}
