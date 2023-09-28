import Layout from "./Layout";
import Size from "./size";

import Direction, { Axis } from "./direction";

export default interface Positioned {
  getLayout(): Layout;
  size(bodySize?: Size): Size;
  getSeparation(axis: Axis, dir: Direction, preferVertical: boolean): number;
}
