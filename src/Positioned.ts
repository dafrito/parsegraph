import Layout from "./Layout";
import Size from "parsegraph-size";

import Direction, { Axis } from "parsegraph-direction";

export default interface Positioned {
  getLayout(): Layout;
  size(bodySize?: Size): Size;
  getSeparation(axis: Axis, dir: Direction, preferVertical: boolean): number;
}
