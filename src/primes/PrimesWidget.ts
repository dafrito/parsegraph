import PrimesModulo from "./PrimesModulo";
import { DirectionCaret } from "../direction";

export default class PrimesWidget {
  position: number;
  knownPrimes: PrimesModulo[];
  caret: DirectionCaret<any>;
  _paused: boolean;

  constructor() {
    this.knownPrimes = [];
    this.position = 2;

    this.caret = new DirectionCaret(1);
  }

  isPaused() {
    return this._paused;
  }

  step() {
    // console.log("Stepping primes widget");
    // Check if any known prime is a multiple of the current position.
    const car = new DirectionCaret(this.position);
    car.id(this.position);
    car.push();
    car.pull("u");
    car.crease();
    let isPrime = true;

    for (let i = 0; i < this.knownPrimes.length; ++i) {
      const prime = this.knownPrimes[i];
      const modulus = prime.calculate(this.position);
      if (modulus == 0) {
        // It's a multiple, so there's no chance for primality.
        car.spawnMove("u", prime.frequency);
        isPrime = false;
      } else {
        car.spawnMove("u", "s");
      }
      this.caret.id(this.position + ":" + prime.frequency);
      if (i === 0) {
        car.crease();
      }
    }
    if (isPrime) {
      // The position is prime, so output it and add it to the list.
      car.spawnMove("u", this.position);
      car.id(this.position + ":" + this.position);
      this.knownPrimes.push(new PrimesModulo(this.position));
    }

    car.pop();
    car.connect('b', this.caret.root());
    this.caret = car;

    // Advance.
    ++this.position;
  }

  node(): any {
    return this.caret.root();
  }
}
