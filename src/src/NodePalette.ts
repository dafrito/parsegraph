import DirectionNode from "./DirectionNode";

export type NodePalette<Value = any, Given = any> = (given?: Given) => Value;

export interface InplaceNodePalette<Value = any, Given = any> {
  spawn(given?: Given): DirectionNode<Value>;
  replace(node: DirectionNode<Value>, given?: Given): void;
}

export class BasicNodePalette<Value = any, Given = any>
  implements InplaceNodePalette<Value, Given>
{
  _builder: NodePalette<Value, Given>;

  constructor(builder: NodePalette<Value, Given>) {
    this._builder = builder;
  }

  spawn(given?: Given): DirectionNode<Value> {
    const node = new DirectionNode<Value>();
    node.setValue(this._builder(given));
    return node;
  }

  replace(node: DirectionNode<Value>, given?: Given): void {
    node.setValue(this._builder(given));
  }
}

export default NodePalette;
