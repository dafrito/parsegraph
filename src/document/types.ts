/** Values that survive a JSON document round trip without custom conversion. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface NodeStyle {
  minWidth: number;
  minHeight: number;
  paddingX: number;
  paddingY: number;
  square: boolean;
}

/** Geometry rules in logical units, interpreted by the viewer's sizing adapter. */
export interface Presentation {
  text: { fontFamily: string; fontSize: number; lineHeight: number };
  styles: { [name: string]: NodeStyle };
  defaultStyle: string;
  nodeStyles: { [id: string]: string };
  spacing: {
    horizontal: number;
    vertical: number;
    inward: number;
    verticalStep?: number;
  };
}

/** sRGB #RRGGBB colors with independent, unpremultiplied alpha channels. */
export interface NodeAppearance {
  backgroundColor: string;
  backgroundAlpha: number;
  borderColor: string;
  borderAlpha: number;
  textColor: string;
  textAlpha: number;
  lineColor: string;
  lineAlpha: number;
}

/** Optional decoration, independent of layout and presentation style names. */
export interface Appearance {
  defaults: NodeAppearance;
  nodeStyles: { [id: string]: Partial<NodeAppearance> };
  pageBackgroundColor: string;
  pageBackgroundAlpha: number;
}

export interface DocumentNode {
  id: string;
  value?: JsonValue;
  scale: number;
  fit: "exact" | "loose" | "naive";
  layoutPreference: "parent" | "perpendicular" | "horizontal" | "vertical";
  parentId: string | null;
  parentDir:
    | "inward"
    | "outward"
    | "downward"
    | "upward"
    | "forward"
    | "backward"
    | null;
  alignment:
    | "none"
    | "negative"
    | "center"
    | "positive"
    | "inward-horizontal"
    | "inward-vertical";
  axisOverlap: "allowed" | "prevented" | "default";
  rightToLeft: boolean;
  /** Explicit group boundary; the root forms a group even when false. */
  paintGroup: boolean;
}

/** The v1 envelope deliberately differs from v0's __parsegraph node map. */
export interface ParsegraphDocument {
  format: "parsegraph";
  version: 1;
  root: string;
  nodes: DocumentNode[];
  capabilities: Capabilities;
  /** Optional annotations that must not change graph or presentation semantics. */
  metadata?: { [namespace: string]: JsonValue };
}

/** Capability names identify independently interpretable JSON payloads. */
export interface Capabilities {
  [name: string]: JsonValue | Presentation | Appearance;
}

export interface DocumentOptions {
  presentation?: Presentation;
  appearance?: Appearance;
  capabilities?: Capabilities;
  metadata?: ParsegraphDocument["metadata"];
}
