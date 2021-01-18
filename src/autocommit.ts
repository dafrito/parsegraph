export enum AutocommitBehavior {
  THROW,
  COMMIT
}
let autocommitBehavior = AutocommitBehavior.COMMIT;
export default AutocommitBehavior;

export function setAutocommitBehavior(behavior:AutocommitBehavior) {
  autocommitBehavior = behavior;
}

export function getAutocommitBehavior():AutocommitBehavior {
  return autocommitBehavior;
}
