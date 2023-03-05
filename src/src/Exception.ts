export const NULL_STATUS = 0;
export const OK = 1;
export const BAD_STATUS = 2;
export const NO_NODE_FOUND = 3;
export const ALREADY_OCCUPIED = 4;
export const BAD_NODE_DIRECTION = 5;
export const BAD_NODE_CONTENT = 6;
export const BAD_AXIS = 7;
export const BAD_LAYOUT_STATE = 8;
export const BAD_NODE_ALIGNMENT = 9;
export const CANNOT_AFFECT_PARENT = 10;
export const OFFSET_IS_NEGATIVE = 11;
export const NODE_IS_ROOT = 12;
export const BAD_LAYOUT_PREFERENCE = 13;
export const BAD_AXIS_OVERLAP = 14;
export const BAD_NODE_TYPE = 15;
export const BAD_NODE_FIT = 16;
export const NODE_DIRTY = 17;
export const NO_OUTWARD_CONNECT = 18;
export const NO_PARENT_CONNECT = 19;
export const NOT_PAINT_GROUP = 20;

let descriptions: { [key: number]: string } = null;
export function nameStatus(given: number) {
  if (!descriptions) {
    descriptions = {
      [NULL_STATUS]: "NULL_STATUS",
      [OK]: "OK",
      [NO_NODE_FOUND]: "NO_NODE_FOUND",
      [ALREADY_OCCUPIED]: "ALREADY_OCCUPIED",
      [BAD_NODE_DIRECTION]: "BAD_NODE_DIRECTION",
      [BAD_NODE_CONTENT]: "BAD_NODE_CONTENT",
      [BAD_AXIS]: "BAD_AXIS",
      [BAD_LAYOUT_STATE]: "BAD_LAYOUT_STATE",
      [BAD_NODE_ALIGNMENT]: "BAD_NODE_ALIGNMENT",
      [NODE_IS_ROOT]: "NODE_IS_ROOT",
      [BAD_STATUS]: "BAD_STATUS",
      [CANNOT_AFFECT_PARENT]: "CANNOT_AFFECT_PARENT",
      [OFFSET_IS_NEGATIVE]: "OFFSET_IS_NEGATIVE",
      [BAD_LAYOUT_PREFERENCE]: "BAD_LAYOUT_PREFERENCE",
      [BAD_AXIS_OVERLAP]: "BAD_AXIS_OVERLAP",
      [BAD_NODE_TYPE]: "BAD_NODE_TYPE",
      [BAD_NODE_FIT]: "BAD_NODE_FIT",
      [NODE_DIRTY]: "NODE_DIRTY",
      [NO_OUTWARD_CONNECT]:
        "By rule, nodes cannot be spawned in the outward direction.",
      [NO_PARENT_CONNECT]: "Cannot connect a node in the parent's direction",
      [NOT_PAINT_GROUP]: "Paint group returned is not a paint group",
    };
  }
  if (descriptions[given]) {
    return descriptions[given];
  }
  throw createException(BAD_STATUS, given);
}

export default function createException(exceptionCode: number, ...args: any[]) {
  if (args.length > 0) {
    return new Error(nameStatus(exceptionCode) + "\nArguments: " + args);
  }
  return new Error(nameStatus(exceptionCode));
}
