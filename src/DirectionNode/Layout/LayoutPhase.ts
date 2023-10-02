export enum LayoutPhase {
  NULL = 0,
  NEEDS_COMMIT,
  COMMITTED,
  IN_COMMIT,
}

export function nameLayoutPhase(given: LayoutPhase): string {
  switch (given) {
    case LayoutPhase.NULL:
      return "NULL";
    case LayoutPhase.NEEDS_COMMIT:
      return "NEEDS_COMMIT";
    case LayoutPhase.COMMITTED:
      return "COMMITTED";
    case LayoutPhase.IN_COMMIT:
      return "IN_COMMIT";
  }
  throw new Error("Unknown LayoutPhase given: " + given);
}
