import createException, { BAD_LAYOUT_STATE } from "./Exception";

export enum LayoutState {
  NULL = 0,
  NEEDS_COMMIT,
  COMMITTED,
  IN_COMMIT,
}

export function nameLayoutState(given: LayoutState): string {
  switch (given) {
    case LayoutState.NULL:
      return "NULL";
    case LayoutState.NEEDS_COMMIT:
      return "NEEDS_COMMIT";
    case LayoutState.COMMITTED:
      return "COMMITTED";
    case LayoutState.IN_COMMIT:
      return "IN_COMMIT";
  }
  throw createException(BAD_LAYOUT_STATE, given);
}

export default LayoutState;
