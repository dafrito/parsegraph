import createException, { BAD_AXIS_OVERLAP } from "./Exception";

export enum AxisOverlap {
  NULL = 18,
  ALLOWED,
  PREVENTED,
  DEFAULT,
}
export default AxisOverlap;

export function nameAxisOverlap(given: AxisOverlap): string {
  switch (given) {
    case AxisOverlap.NULL:
      return "NULL";
    case AxisOverlap.ALLOWED:
      return "ALLOWED";
    case AxisOverlap.PREVENTED:
      return "PREVENTED";
    case AxisOverlap.DEFAULT:
      return "DEFAULT";
  }
  throw createException(BAD_AXIS_OVERLAP);
}

export function readAxisOverlap(given: string): AxisOverlap {
  if (typeof given === "number") {
    return given;
  }
  if (typeof given === "string") {
    given = given.toLowerCase();
    switch (given) {
      case "a":
      case "allow":
        return AxisOverlap.ALLOWED;
      case "p":
      case "prevent":
        return AxisOverlap.PREVENTED;
      case "d":
      case "def":
      case "default":
        return AxisOverlap.DEFAULT;
    }
  }
  return AxisOverlap.NULL;
}
