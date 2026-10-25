import { Extent } from "../Extent";
import { Fit } from "../../Fit";

const firstBounds = [0, 0, 0];
const secondBounds = [0, 0, 0];

/** Compare contours or their bounding rectangles without altering either extent.
 * @param {Extent} first - Base contour.
 * @param {Extent} second - Facing contour.
 * @param {number} offset - Perpendicular displacement in base units.
 * @param {boolean} overlap - Allow crossing the other origin outside shared spans.
 * @param {number} scale - Second contour scale.
 * @param {Fit} fit - Separation policy.
 * @return {number} Required separation in base units.
 */
export function separateExtents(
  first: Extent,
  second: Extent,
  offset: number,
  overlap: boolean,
  scale: number,
  fit: Fit
): number {
  if (fit !== Fit.LOOSE)
    return first.separation(second, offset, overlap, scale);
  first.boundingValues(firstBounds);
  second.boundingValues(secondBounds);
  const a = firstBounds[2];
  const b = secondBounds[2] * scale;
  let result = overlap ? 0 : Math.max(0, isNaN(a) ? 0 : a, isNaN(b) ? 0 : b);
  if (
    firstBounds[0] > 0 &&
    secondBounds[0] > 0 &&
    Math.max(0, offset) <
      Math.min(firstBounds[0], offset + secondBounds[0] * scale) &&
    !isNaN(a) &&
    !isNaN(b)
  )
    result = Math.max(result, a + b);
  return result;
}
