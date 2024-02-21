import { assert, expect } from 'chai';
import { Direction, Alignment } from '.';
import { DirectionNode } from './DirectionNode/DirectionNode';
import { serializeParsegraph, deserializeParsegraph} from './serializeParsegraph';

describe("serializeParsegraph", () => {
  it("works", () => {
    const node = new DirectionNode("Hello!");
    const json = serializeParsegraph(node);
    const newNode = deserializeParsegraph(json);
    assert.equal(node.value(), newNode.value());
  });

  it("works for multiple nodes", () => {
    const root = new DirectionNode("Hello!");
    let node = root;
    const numChildren = 3;
    for (let i = 0; i < numChildren; ++i) {
      const child = new DirectionNode(i);
      node.connect(Direction.FORWARD, child);
      node = child;
    }
    const json = serializeParsegraph(root);
    const newRoot = deserializeParsegraph(json);

    let testNode = newRoot;
    node = root;
    for (let i = 0; i < numChildren; ++i) {
      assert.isOk(node);
      assert.isOk(testNode, "i=" + i);
      assert.equal(node.value(), testNode.value());
      testNode = testNode.neighbors().nodeAt(Direction.FORWARD);
      node = node.neighbors().nodeAt(Direction.FORWARD);
    }
  });
  it("works with scaling", () => {
    const root = new DirectionNode("Hello!");
    let node = root;
    const numChildren = 3;
    for (let i = 0; i < numChildren; ++i) {
      const child = new DirectionNode(i);
      child.setScale(0.5);
      node.connect(Direction.FORWARD, child);
      node = child;
    }
    const json = serializeParsegraph(root);
    const newRoot = deserializeParsegraph(json);

    let testNode = newRoot;
    node = root;
    for (let i = 0; i < numChildren; ++i) {
      assert.isOk(node);
      assert.isOk(testNode, "i=" + i);
      assert.equal(node.value(), testNode.value());
      assert.equal(node.scale(), testNode.scale());
      testNode = testNode.neighbors().nodeAt(Direction.FORWARD);
      node = node.neighbors().nodeAt(Direction.FORWARD);
    }
  });

  it("preserves alignment", () => {
    const root = new DirectionNode("Hello!");
    let node = root;
    const numChildren = 3;
    for (let i = 0; i < numChildren; ++i) {
      const child = new DirectionNode(i);

      let par = child;
      for (let x = 0; x < numChildren; ++x) {
        const cell = new DirectionNode(x);
        par.connect(x === 0 ? Direction.UPWARD : Direction.FORWARD, cell);
        par = cell;
      }
      node.neighbors().align(Direction.UPWARD, Alignment.CENTER);
      node.connect(Direction.FORWARD, child);
      node = child;
    }
    const json = serializeParsegraph(root);
    const newRoot = deserializeParsegraph(json);

    let testNode = newRoot;
    node = root;
    for (let i = 0; i < numChildren; ++i) {
      assert.isOk(node);
      assert.isOk(testNode, "i=" + i);
      assert.equal(node.value(), testNode.value());
      assert.equal(node.scale(), testNode.scale());

      if (i > 0) {
        assert.isOk(testNode.neighbors().nodeAt(Direction.UPWARD));
        assert.equal(Alignment.CENTER, testNode.neighbors().getAlignment(Direction.UPWARD));
      }

      testNode = testNode.neighbors().nodeAt(Direction.FORWARD);
      node = node.neighbors().nodeAt(Direction.FORWARD);
    }
  });

  it("preserves creasing", () => {
    const root = new DirectionNode("Hello!");
    let node = root;
    const numChildren = 3;
    for (let i = 0; i < numChildren; ++i) {
      const child = new DirectionNode(i);

      let par = child;
      for (let x = 0; x < numChildren; ++x) {
        const cell = new DirectionNode(x);
        par.connect(x === 0 ? Direction.UPWARD : Direction.FORWARD, cell);
        if (x === 0) {
          cell.paintGroups().crease();
        }
        par = cell;
      }
      node.neighbors().align(Direction.UPWARD, Alignment.CENTER);
      node.connect(Direction.FORWARD, child);
      node = child;
    }
    const json = serializeParsegraph(root);
    const newRoot = deserializeParsegraph(json);

    let testNode = newRoot;
    node = root;
    for (let i = 0; i < numChildren; ++i) {
      assert.isOk(node);
      assert.isOk(testNode, "i=" + i);
      assert.equal(node.value(), testNode.value());
      assert.equal(node.scale(), testNode.scale());

      if (i > 0) {
        assert.isOk(testNode.neighbors().nodeAt(Direction.UPWARD));
        assert.equal(Alignment.CENTER, testNode.neighbors().getAlignment(Direction.UPWARD));
        assert.isTrue(testNode.neighbors().nodeAt(Direction.UPWARD).paintGroups().isPaintGroup());
      }

      testNode = testNode.neighbors().nodeAt(Direction.FORWARD);
      node = node.neighbors().nodeAt(Direction.FORWARD);
    }
  });

});
