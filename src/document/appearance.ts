import { Appearance, NodeAppearance } from "./types";

/**
 * Resolve validated appearance without inheriting from parent nodes or styles.
 * @param {Appearance} appearance - Validated appearance/1 payload.
 * @param {string} id - Node ID to resolve.
 * @return {NodeAppearance} Independent resolved color/alpha fields.
 */
export function resolveNodeAppearance(
  appearance: Appearance,
  id: string
): NodeAppearance {
  return {
    ...appearance.defaults,
    ...(Object.prototype.hasOwnProperty.call(appearance.nodeStyles, id)
      ? appearance.nodeStyles[id]
      : {}),
  };
}
