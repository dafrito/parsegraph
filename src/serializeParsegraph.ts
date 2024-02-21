import { Alignment, Direction, PreferredAxis, reverseDirection } from ".";
import { DirectionNode } from "./DirectionNode/DirectionNode";

interface DirectionNodeData {
  value: any;
  scale: number;
  layoutPreference: PreferredAxis;
  parentId: null | string | number;
  parentDir: null | Direction;
  alignment: Alignment;
  paintGroup: boolean;
}

const serializeParsegraph = (root: DirectionNode) => {
  const nodes: { [key: string]: DirectionNodeData } = {};
  root.paintGroup().forEach((pg) => {
    pg.siblings().forEachNode((node) => {
      nodes[node.id()] = {
        value: node.value(),
        scale: node.scale(),
        layoutPreference: node.siblings().getLayoutPreference(),
        parentId: node.neighbors().isRoot()
          ? null
          : node.neighbors().parentNode().id(),
        parentDir: node.neighbors().isRoot()
          ? null
          : node.neighbors().parentDirection(),
        alignment: node.neighbors().isRoot()
          ? Alignment.NONE
          : node
              .neighbors()
              .parentNode()
              .neighbors()
              .getAlignment(
                reverseDirection(node.neighbors().parentDirection())
              ),
        paintGroup: node.paintGroups().isPaintGroup(),
      };
    });
  });
  return nodes;
};

const deserializeParsegraph = (json: { [key: string]: DirectionNodeData }): DirectionNode => {
  const nodes: { [key: string]: DirectionNode } = {};
  let root = null;
  Object.keys(json).forEach((id) => {
    const nodeData = json[id];
    const node = new DirectionNode(nodeData.value);
    node.setScale(nodeData.scale);
    nodes[id] = node;
    if (nodeData.parentId === null) {
      root = nodes[id];
    }
  });
  Object.keys(json).forEach((id) => {
    if (json[id].parentId === null) {
      return;
    }
    const parentNode = nodes[json[id].parentId];
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

export { serializeParsegraph, deserializeParsegraph };
