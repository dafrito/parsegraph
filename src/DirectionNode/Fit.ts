export enum Fit {
  NULL = 14,
  EXACT,
  LOOSE,
  NAIVE,
}
export default Fit;

export function nameFit(given: Fit): string {
  switch (given) {
    case Fit.NULL:
      return "NULL";
    case Fit.EXACT:
      return "EXACT";
    case Fit.LOOSE:
      return "LOOSE";
    case Fit.NAIVE:
      return "NAIVE";
  }
  throw new Error("Unknown Fit: " + given);
}

export function readFit(given: string): Fit {
  if (typeof given === "number") {
    return given;
  }
  given = given.toLowerCase();
  switch (given) {
    case "e":
    case "exact":
      return Fit.EXACT;
    case "l":
    case "loose":
      return Fit.LOOSE;
    case "n":
    case "naive":
      return Fit.NAIVE;
  }
  return Fit.NULL;
}
