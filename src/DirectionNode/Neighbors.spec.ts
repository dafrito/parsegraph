import { assert } from "chai";

import { Neighbors } from "./Neighbors";
import { DirectionNode } from "./DirectionNode";
import { Direction } from "../Direction/constants";

describe("Neighbors", () => {
    it("can be created", () => {
        const node = new DirectionNode();
        const neighbors = new Neighbors(node);
        assert.instanceOf(neighbors, Neighbors);
    });

    it("can get a neighbor", () => {
        const node = new DirectionNode();
        const neighbors = new Neighbors(node);
        assert.isUndefined(neighbors.at(Direction.UPWARD));
        neighbors.ensure(Direction.UPWARD);
        assert.isDefined(neighbors.at(Direction.UPWARD));
    });
});