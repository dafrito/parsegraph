import { expect } from 'chai';
import data from './buggy-graph-with-crease.parsegraph.json';
import { deserializeParsegraph } from './serializeParsegraph';
import { CommitLayout, DirectionNode, PreferredAxis, namePreferredAxis } from '.';

const createLayout = (node) => {
  return new CommitLayout(node, {
    size: (node, size) => {
      size[0] = 24;
      size[1] = 24;
    },
    getSeparation: () => 10
  });
};

describe("alignment", () => {
  it("works with big creased graph", () => {
    expect(data).to.be.an('object');
    const root = deserializeParsegraph(data);
    expect(root).to.be.an.instanceof(DirectionNode);

    const count = () => {
      let total = 0;
      const TRIGGER = 10000;
      /*const cld = createLayout(root);
      while (cld.crank()) {
          if (total++ > TRIGGER) {
            throw new Error("looping endlessly");
          }
      }*/

      let groups = 0;
      let nodes = 0;
      root.paintGroup().forEach(pg => {
        groups++;
        pg.siblings().forEach(node => {
          if (total++ > TRIGGER) {
            throw new Error("looping endlessly");
          }
          if (total > TRIGGER-20) {
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

    expect(root.siblings().getLayoutPreference()).to.equal(PreferredAxis.HORIZONTAL, namePreferredAxis(root.siblings().getLayoutPreference()));
    root.siblings().setLayoutPreference(PreferredAxis.VERTICAL);

    [groups, nodes] = count();
    expect(nodes).to.be.greaterThan(1);
    expect(groups).to.be.greaterThan(1);
  });
});
