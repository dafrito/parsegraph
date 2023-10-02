/**
 * Alignment is a NeighborData-specific property, so it can be set before the neighbor is connected.
 *
 * A neighbor with no special alignment is aligned with its own body separated from its parent. A neighbor can also be arranged to be positively or negatively aligned with its parent, resulting in a shift of the neighbor and its contents.
 *
 * Inward neighbors are aligned either directly forward or directly downward of their parents, so their alignment is specifc.
 *
 */
export enum Alignment {
  NULL = 0,
  NONE,
  NEGATIVE,
  CENTER,
  POSITIVE,
  // Used to align inward nodes.
  INWARD_HORIZONTAL,
  INWARD_VERTICAL,
}
export default Alignment;

export function nameAlignment(given: Alignment): string {
  switch (given) {
    case Alignment.NULL:
      return "NULL";
    case Alignment.NONE:
      return "NONE";
    case Alignment.NEGATIVE:
      return "NEGATIVE";
    case Alignment.CENTER:
      return "CENTER";
    case Alignment.POSITIVE:
      return "POSITIVE";
    case Alignment.INWARD_HORIZONTAL:
      return "HORIZONTAL";
    case Alignment.INWARD_VERTICAL:
      return "VERTICAL";
  }
  throw new Error("Unknown Alignment given: " + given);
}

export function readAlignment(given: string | Alignment): Alignment {
  if (typeof given === "number") {
    return given;
  }
  if (typeof given === "string") {
    given = given.toLowerCase();
    switch (given) {
      case "none":
      case "no":
        return Alignment.NONE;
      case "negative":
      case "neg":
      case "n":
        return Alignment.NEGATIVE;
      case "positive":
      case "pos":
      case "p":
        return Alignment.POSITIVE;
      case "center":
      case "c":
        return Alignment.CENTER;
      case "vertical":
      case "v":
        return Alignment.INWARD_VERTICAL;
      case "horizontal":
      case "h":
        return Alignment.INWARD_HORIZONTAL;
    }
  }

  return Alignment.NULL;
}
