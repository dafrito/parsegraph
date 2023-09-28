import { DirectionCaret } from "./direction";
import Positioned from "./Positioned";

export type LayoutCaret<Value extends Positioned = Positioned> =
  DirectionCaret<Value>;
export default LayoutCaret;
