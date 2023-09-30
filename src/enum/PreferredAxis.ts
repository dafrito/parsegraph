import createException, { BAD_LAYOUT_PREFERENCE } from "./Exception";

export enum PreferredAxis {
  NULL = 0,
  PARENT,
  PERPENDICULAR,
  HORIZONTAL,
  VERTICAL,
}

export default PreferredAxis;

export function namePreferredAxis(given: PreferredAxis): string {
  switch (given) {
    case PreferredAxis.NULL:
      return "NULL";
    case PreferredAxis.PARENT:
      return "PARENT";
    case PreferredAxis.PERPENDICULAR:
      return "PERPENDICULAR";
    case PreferredAxis.HORIZONTAL:
      return "HORIZONTAL";
    case PreferredAxis.VERTICAL:
      return "VERTICAL";
  }
  throw createException(BAD_LAYOUT_PREFERENCE, given);
}

export function readPreferredAxis(given: string | number): PreferredAxis {
  if (typeof given === "number") {
    return given;
  }
  given = given.toLowerCase();
  switch (given) {
    case "pa":
    case "par":
    case "parent":
      return PreferredAxis.PARENT;
    case "pe":
    case "perp":
    case "perpendicular":
      return PreferredAxis.PERPENDICULAR;
    case "v":
    case "vert":
    case "vertical":
      return PreferredAxis.VERTICAL;
    case "h":
    case "horz":
    case "horizontal":
      return PreferredAxis.HORIZONTAL;
  }
  return PreferredAxis.NULL;
}
