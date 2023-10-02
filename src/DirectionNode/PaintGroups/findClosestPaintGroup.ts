import { DirectionNode } from "../DirectionNode";
import { findDistance } from "./findDistance";

export const findClosestPaintGroup = (
  inserted: DirectionNode,
  paintGroupCandidates: DirectionNode[]
) => {
  // Compute distances from the inserted node
  const paintGroupDistances = paintGroupCandidates.map((candidateNode) =>
    findDistance(inserted, candidateNode)
  );

  const closestPaintGroupIndex = paintGroupDistances.reduce(
    (lowestDistanceIndex, candDistance, index) => {
      if (lowestDistanceIndex === -1) {
        return index;
      }

      if (candDistance <= paintGroupDistances[lowestDistanceIndex]) {
        return index;
      }

      return lowestDistanceIndex;
    },
    -1
  );

  return paintGroupCandidates[closestPaintGroupIndex];
};
