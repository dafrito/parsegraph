import { Direction, reverseDirection } from "../Direction";
import {
  DirectionNode,
  Fit,
  Alignment,
  PreferredAxis,
  AxisOverlap,
} from "../DirectionNode";
import { deserializeParsegraph } from "../serializeParsegraph";
import { forEachSerializedNode } from "../serializationTraversal";
import {
  ParsegraphDocument,
  Presentation,
  Appearance,
  DocumentNode,
  JsonValue,
  DocumentOptions,
  Capabilities,
} from "./types";
import {
  DIRECTIONS,
  FITS,
  PREFERENCES,
  ALIGNMENTS,
  OVERLAPS,
  validateParsegraphDocument,
  hasVersionMarker,
} from "./validate";

/**
 * Serialize a graph and capability payloads, checking for lossless JSON content.
 * @param {DirectionNode} root - The actual graph root.
 * @param {DocumentOptions} options - Capabilities and metadata to retain.
 * @return {ParsegraphDocument} An independent, validated JSON document.
 */
export function serializeParsegraphDocument(
  root: DirectionNode,
  options: DocumentOptions = {}
): ParsegraphDocument {
  if (!root.neighbors().isRoot())
    throw new Error("Serialize from the actual graph root");
  const nodes: DocumentNode[] = [];
  forEachSerializedNode(root, (node) => {
    const isRoot = node.neighbors().isRoot();
    const parent = isRoot ? null : node.neighbors().parentNode();
    const parentDir = isRoot ? null : node.neighbors().parentDirection();
    const childDir = isRoot ? null : reverseDirection(parentDir);
    nodes.push({
      id: node.id() as string,
      ...(node.value() !== undefined
        ? { value: node.value() as JsonValue }
        : {}),
      scale: node.scale(),
      fit: FITS[node.nodeFit() - Fit.EXACT],
      layoutPreference:
        PREFERENCES[
          node.siblings().getLayoutPreference() - PreferredAxis.PARENT
        ],
      parentId: parent ? (parent.id() as string) : null,
      parentDir: isRoot ? null : DIRECTIONS[parentDir],
      alignment: isRoot
        ? "none"
        : ALIGNMENTS[
            parent.neighbors().getAlignment(childDir) - Alignment.NONE
          ],
      axisOverlap: isRoot
        ? "default"
        : OVERLAPS[
            parent.neighbors().axisOverlap(childDir) - AxisOverlap.ALLOWED
          ],
      rightToLeft: node.rightToLeft(),
      paintGroup:
        node.paintGroups().isPaintGroup() && node.paintGroup().explicit(),
    });
  });
  const document: ParsegraphDocument = {
    format: "parsegraph",
    version: 1,
    root: root.id() as string,
    nodes,
    capabilities: {
      ...options.capabilities,
      ...(options.presentation !== undefined
        ? { "presentation/1": options.presentation }
        : {}),
      ...(options.appearance !== undefined
        ? { "appearance/1": options.appearance }
        : {}),
    },
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
  };
  validateParsegraphDocument(document);
  return JSON.parse(JSON.stringify(document));
}

export interface LoadedParsegraphDocument extends DocumentOptions {
  version: 0 | 1;
  root: DirectionNode;
  capabilities: Capabilities;
  ignoredCapabilities: string[];
}

/**
 * Load v0 with legacy behavior, or validate and load a complete v1 document.
 * @param {unknown} input - A parsed JSON document.
 * @return {LoadedParsegraphDocument} Graph, capabilities, and application metadata.
 */
export function deserializeParsegraphDocument(
  input: unknown
): LoadedParsegraphDocument {
  if (!hasVersionMarker(input)) {
    const root = deserializeParsegraph(
      input as Parameters<typeof deserializeParsegraph>[0]
    );
    return { version: 0, root, capabilities: {}, ignoredCapabilities: [] };
  }
  validateParsegraphDocument(input);
  const document: ParsegraphDocument = JSON.parse(JSON.stringify(input));
  const nodes = new Map<string, DirectionNode>();
  document.nodes.forEach((record) => {
    const node = new DirectionNode(record.value);
    node.setId(record.id);
    node.setScale(record.scale);
    node.setNodeFit(Fit.EXACT + FITS.indexOf(record.fit));
    node.setRightToLeft(record.rightToLeft);
    if (record.paintGroup) node.paintGroups().crease();
    nodes.set(record.id, node);
  });
  document.nodes.forEach((record) => {
    if (record.parentId === null) return;
    const parent = nodes.get(record.parentId) as DirectionNode;
    const direction = reverseDirection(
      DIRECTIONS.indexOf(record.parentDir) as Direction
    );
    parent.connect(direction, nodes.get(record.id) as DirectionNode);
    parent
      .neighbors()
      .align(direction, Alignment.NONE + ALIGNMENTS.indexOf(record.alignment));
    parent
      .neighbors()
      .setAxisOverlap(
        direction,
        AxisOverlap.ALLOWED + OVERLAPS.indexOf(record.axisOverlap)
      );
  });
  // Apply preferences after all connections, independent of record ordering.
  document.nodes.forEach((record) => {
    nodes
      .get(record.id)
      .siblings()
      .setLayoutPreference(
        PreferredAxis.PARENT + PREFERENCES.indexOf(record.layoutPreference)
      );
  });
  return {
    version: 1,
    root: nodes.get(document.root),
    capabilities: document.capabilities,
    ignoredCapabilities: Object.keys(document.capabilities).filter(
      (name) => name !== "presentation/1" && name !== "appearance/1"
    ),
    ...(Object.prototype.hasOwnProperty.call(
      document.capabilities,
      "presentation/1"
    )
      ? {
          presentation: document.capabilities["presentation/1"] as Presentation,
        }
      : {}),
    ...(document.metadata !== undefined ? { metadata: document.metadata } : {}),
    ...(Object.prototype.hasOwnProperty.call(
      document.capabilities,
      "appearance/1"
    )
      ? { appearance: document.capabilities["appearance/1"] as Appearance }
      : {}),
  };
}
