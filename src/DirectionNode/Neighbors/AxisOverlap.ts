import createException, { BAD_AXIS_OVERLAP } from "../../Exception";

/**
 * The NeighborData-specific configuration setting to set whether this
 * neighbor's axis can overlap its parent.
 *
 * If true, the neighbor can pass "underneath" its parent.
 *
 * @see {@link nameAxisOverlap}
 * @see {@link readAxisOverlap}
 */
export enum AxisOverlap {
  NULL = 18,
  ALLOWED,
  PREVENTED,
  DEFAULT,
}
export default AxisOverlap;

/**
 * Returns a string representing the given {@link AxisOverlap}.
 *
 * @param {AxisOverlap} given - the AxisOverlap to name
 * @return {string} text representing the given AxisOverlap
 */
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

/**
 * Returns the AxisOverlap representing the given string.
 *
 * @param {string} given - the string representing an AxisOverlap. Generally "allow", "prevent", or "default"
 * @return {AxisOverlap} the AxisOverlap represented by the given string, or {@link AxisOverlap.NULL}.
 */
export function readAxisOverlap(given: string): AxisOverlap {
  if (typeof given === "number") {
    return given;
  }
  if (typeof given === "string") {
    given = given.toLowerCase();
    switch (given) {
      case "a":
      case "allow":
      case "allowed":
        return AxisOverlap.ALLOWED;
      case "p":
      case "prevent":
      case "prevented":
        return AxisOverlap.PREVENTED;
      case "d":
      case "def":
      case "default":
      case "defaulted":
        return AxisOverlap.DEFAULT;
    }
  }
  return AxisOverlap.NULL;
}
