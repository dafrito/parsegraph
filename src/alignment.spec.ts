import { expect } from "chai";
import data from "./buggy-graph-with-crease.parsegraph.json";
import buggyAlignment from "./graph-buggy-alignment.parsegraph.json";
import { deserializeParsegraph } from "./serializeParsegraph";
import {
  Alignment,
  CommitLayout,
  Direction,
  DirectionCaret,
  DirectionNode,
  PreferredAxis,
  namePreferredAxis,
} from ".";

const createLayout = (node: DirectionNode) => {
  return new CommitLayout(node, {
    size: (node, size) => {
      size[0] = 24;
      size[1] = 24;
    },
    getSeparation: () => 10,
  });
};

describe("alignment", () => {
  it("alignment deletion test from srouce", () => {
    const layout = () => {
      const TRIGGER = 10000;
      let total = 0;
      const root = car.origin();
      const cld = createLayout(root);
      while (cld.crank()) {
        if (total++ > TRIGGER) {
          throw new Error("looping endlessly");
        }
      }
    };

    const car = new DirectionCaret(deserializeParsegraph(buggyAlignment as any));
    layout();
    car.move('f')
    car.move('f')
    car.move('u')
    car.move('u')
    car.disconnect();
    layout();
  });

  it("alignment deletion test", () => {
    const layout = () => {
      const TRIGGER = 10000;
      let total = 0;
      const root = car.origin();
      const cld = createLayout(root);
      while (cld.crank()) {
        if (total++ > TRIGGER) {
          throw new Error("looping endlessly");
        }
      }
    };
    const car = new DirectionCaret();
    layout();
    car.spawnMove('f');
    layout();
    car.spawnMove('f');
    layout();
    car.spawnMove('f');
    layout();
    car.push();
    car.spawnMove('u');
    layout();
    const id = car.save();
    car.pop();
    car.node().neighbors().parentNode().neighbors().align(Direction.FORWARD, Alignment.NEGATIVE);
    layout();
    car.restore(id);
    car.disconnect();
    layout();
  });

  it("works with big creased graph", () => {
    expect(data).to.be.an("object");
    const root = deserializeParsegraph(data as any);
    expect(root).to.be.an.instanceof(DirectionNode);

    const count = () => {
      let total = 0;
      const TRIGGER = 10000;
      const cld = createLayout(root);
      while (cld.crank()) {
        if (total++ > TRIGGER) {
          throw new Error("looping endlessly");
        }
      }

      let groups = 0;
      let nodes = 0;
      root.paintGroup().forEach((pg) => {
        groups++;
        pg.siblings().forEach((node) => {
          if (total++ > TRIGGER) {
            throw new Error("looping endlessly, group " + groups);
          }
          if (total > TRIGGER - 20) {
            console.log(node.id());
          }
          //expect(node.layout().needsCommit()).to.equal(false);
          //expect(node.layout().needsAbsolutePos()).to.equal(false);
          nodes++;
        });
      });
      return [groups, nodes];
    };

    let [groups, nodes] = count();
    expect(nodes).to.be.greaterThan(1);
    expect(groups).to.be.greaterThan(1);

    expect(root.siblings().getLayoutPreference()).to.equal(
      PreferredAxis.HORIZONTAL,
      namePreferredAxis(root.siblings().getLayoutPreference())
    );
    expect(root.neighbors().isRoot()).to.equal(true);
    root.siblings().setLayoutPreference(PreferredAxis.VERTICAL);

    [groups, nodes] = count();
    expect(nodes).to.be.greaterThan(1);
    expect(groups).to.be.greaterThan(1);
  });
});
