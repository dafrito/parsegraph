import { Direction, DirectionCaret } from "../../..";
import { findConsecutiveLength } from "./findConsecutiveLength";

it("works", () => {
  const car = new DirectionCaret();
  car.spawnMove("u");
  car.spawnMove("u");
  car.disconnect();

  findConsecutiveLength(car.origin(), Direction.UPWARD);
});
