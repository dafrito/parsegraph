import { Direction, Alignment, reverseDirection } from '.';
import { DirectionNode } from './DirectionNode/DirectionNode';

const serializeParsegraph = (root: DirectionNode) => {
  const nodes = {};
  root.paintGroup().forEach(pg => {
    pg.siblings().forEachNode(node => {
      nodes[node.id()] = {
        value: node.value(),
        scale: node.scale(),
        layoutPreference: node.siblings().getLayoutPreference(),
        parentId: node.neighbors().isRoot() ? null : node.neighbors().parentNode().id(),
        parentDir: node.neighbors().isRoot() ? Direction.NULL : node.neighbors().parentDirection(),
        alignment: node.neighbors().isRoot() ? Alignment.NONE : node.neighbors().parent().getAlignment(reverseDirection(node.neighbors().parentDirection())),
        paintGroup: node.paintGroups().isPaintGroup()
      };
    });
  });
  return nodes;
};

const deserializeParsegraph = (json: any): DirectionNode => {
  const nodes = {};
  let root = null;
  Object.keys(json).forEach(id => {
    const nodeData = json[id];
    const node = new DirectionNode(nodeData.value);
    node.setScale(nodeData.scale);
    nodes[id] = node;
    if (nodeData.parentId === null) {
      root = nodes[id];
    }
  });
  Object.keys(json).forEach(id => {
    if (json[id].parentId === null) {
      return;
    }
    const parentNode = nodes[json[id].parentId]
    const childDir = reverseDirection(json[id].parentDir);
    if (json[id].paintGroup) {
      nodes[id].paintGroups().crease();
    }
    parentNode.connect(childDir, nodes[id]);
    parentNode.neighbors().align(childDir, json[id].alignment);
    nodes[id].siblings().setLayoutPreference(json[id].layoutPreference);
  });
  return root;
};

export {
  serializeParsegraph,
  deserializeParsegraph
};
