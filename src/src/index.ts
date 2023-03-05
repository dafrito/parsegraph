import NeighborData from "./NeighborData";
import DirectionNodeSiblings, { SiblingNode } from "./DirectionNodeSiblings";
import DirectionNodePaintGroup, {
  PaintGroupNode,
} from "./DirectionNodePaintGroup";
import DirectionNode from "./DirectionNode";
import DirectionNodeState from "./DirectionNodeState";

import DirectionCaret, { SHRINK_SCALE } from "./DirectionCaret";

import NodePalette, {
  InplaceNodePalette,
  BasicNodePalette,
} from "./NodePalette";

import LayoutState, { nameLayoutState } from "./LayoutState";

import PreferredAxis, {
  namePreferredAxis,
  readPreferredAxis,
} from "./PreferredAxis";

import Direction, {
  NUM_DIRECTIONS,
  HORIZONTAL_ORDER,
  VERTICAL_ORDER,
  readDirection,
  nameDirection,
  isDirection,
  reverseDirection,
  isCardinalDirection,
  forEachCardinalDirection,
  forEachDirection,
  alternateDirection,
} from "./Direction";

import Axis, {
  nameAxis,
  getDirectionAxis,
  isVerticalDirection,
  isHorizontalDirection,
  getPerpendicularAxis,
  isPositiveDirection,
  getPositiveDirection,
  getNegativeDirection,
  isNegativeDirection,
  directionSign,
} from "./Axis";

import { turnLeft, turnRight, turnNegative, turnPositive } from "./turn";

import Alignment, { nameAlignment, readAlignment } from "./Alignment";
import AxisOverlap, { nameAxisOverlap, readAxisOverlap } from "./AxisOverlap";
import Fit, { nameFit, readFit } from "./Fit";

export default Direction;

const FORWARD = Direction.FORWARD;
const BACKWARD = Direction.BACKWARD;
const UPWARD = Direction.UPWARD;
const DOWNWARD = Direction.DOWNWARD;
const INWARD = Direction.INWARD;
const OUTWARD = Direction.OUTWARD;
const NULL = Direction.NULL;

import createException, {
  NULL_STATUS,
  OK,
  BAD_STATUS,
  NO_NODE_FOUND,
  ALREADY_OCCUPIED,
  BAD_NODE_DIRECTION,
  BAD_NODE_CONTENT,
  BAD_AXIS,
  BAD_LAYOUT_STATE,
  BAD_NODE_ALIGNMENT,
  CANNOT_AFFECT_PARENT,
  OFFSET_IS_NEGATIVE,
  NODE_IS_ROOT,
  BAD_LAYOUT_PREFERENCE,
  BAD_AXIS_OVERLAP,
  BAD_NODE_TYPE,
  BAD_NODE_FIT,
  NODE_DIRTY,
  NO_OUTWARD_CONNECT,
  NO_PARENT_CONNECT,
  NOT_PAINT_GROUP,
  nameStatus,
} from "./Exception";

export {
  NULL_STATUS,
  OK,
  BAD_STATUS,
  NO_NODE_FOUND,
  ALREADY_OCCUPIED,
  BAD_NODE_DIRECTION,
  BAD_NODE_CONTENT,
  BAD_AXIS,
  BAD_LAYOUT_STATE,
  BAD_NODE_ALIGNMENT,
  CANNOT_AFFECT_PARENT,
  OFFSET_IS_NEGATIVE,
  NODE_IS_ROOT,
  BAD_LAYOUT_PREFERENCE,
  BAD_AXIS_OVERLAP,
  BAD_NODE_TYPE,
  BAD_NODE_FIT,
  NODE_DIRTY,
  NO_OUTWARD_CONNECT,
  NO_PARENT_CONNECT,
  NOT_PAINT_GROUP,
  nameStatus,
  createException,
  NULL,
  FORWARD,
  BACKWARD,
  UPWARD,
  DOWNWARD,
  INWARD,
  OUTWARD,
  DirectionNode,
  NeighborData,
  DirectionCaret,
  LayoutState,
  nameLayoutState,
  PreferredAxis,
  namePreferredAxis,
  readPreferredAxis,
  Direction,
  NUM_DIRECTIONS,
  Axis,
  HORIZONTAL_ORDER,
  VERTICAL_ORDER,
  readDirection,
  nameDirection,
  isDirection,
  reverseDirection,
  turnLeft,
  turnRight,
  turnNegative,
  turnPositive,
  isCardinalDirection,
  nameAxis,
  getDirectionAxis,
  isVerticalDirection,
  isHorizontalDirection,
  getPerpendicularAxis,
  getPositiveDirection,
  getNegativeDirection,
  forEachDirection,
  forEachCardinalDirection,
  isPositiveDirection,
  isNegativeDirection,
  directionSign,
  alternateDirection,
  NodePalette,
  InplaceNodePalette,
  BasicNodePalette,
  Alignment,
  nameAlignment,
  readAlignment,
  AxisOverlap,
  nameAxisOverlap,
  readAxisOverlap,
  Fit,
  nameFit,
  readFit,
  SHRINK_SCALE,
  SiblingNode,
  DirectionNodeSiblings,
  DirectionNodePaintGroup,
  DirectionNodeState,
  PaintGroupNode,
};
