export class Fuzziness {
  _fuzziness: number;

  constructor(value: number) {
    this.setFuzziness(value);
  }

  setFuzziness(value: number) {
    this._fuzziness = value;
  }

  getFuzziness(): number {
    return this._fuzziness !== undefined
      ? this._fuzziness
      : defaultFuzziness.getFuzziness();
  }

  resetFuzziness() {
    this.setFuzziness(undefined);
  }

  check(a: number, b: number): boolean {
    const fuzziness = this.getFuzziness();
    if (!fuzziness) {
      return a === b;
    }
    return Math.abs(Math.abs(a) - Math.abs(b)) < fuzziness;
  }
}

const defaultFuzziness = new Fuzziness(1e-6);
export function setFuzziness(value: number) {
  defaultFuzziness.setFuzziness(value);
}

export function getFuzziness() {
  return defaultFuzziness.getFuzziness();
}

export function cloneFuzziness() {
  return new Fuzziness(defaultFuzziness.getFuzziness());
}

export default function fuzzyEquals(a: number, b: number, fuzziness?: number) {
  let calc = defaultFuzziness;
  if (fuzziness !== undefined) {
    calc = new Fuzziness(fuzziness);
  }
  return calc.check(a, b);
}
