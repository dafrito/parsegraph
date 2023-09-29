export default class PrimesModulo {
  frequency: number;
  target: number;

  constructor(frequency: number) {
    this.frequency = frequency;
    this.target = 0;
  }

  calculate(num: number) {
    while (num > this.target) {
      this.target += this.frequency;
    }
    return this.target - num;
  }

  value() {
    return this.frequency;
  }
}
