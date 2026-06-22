import { expect, test } from "vitest";
import makeDataVisualizerTabFrom from "../SideContentDataVisualizer";
import { render } from "@testing-library/react";
import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import DataVisualizer from "../dataVisualizer";
import type { Data, Step } from "../dataVisualizerTypes";

const MOCK_CONFIG = {
  sicpTextbookName: "SICP JS Section 2.2",
  sicpTextbookUrl: "https://sourceacademy.org/sicpjs/2.2.html",
  functionCallText: "draw_data(x1, x2, ..., xn)",
};

type DrawableSnapshot = {
  type: string;
  key?: string;
  props?: Record<string, unknown>;
  children?: unknown[];
};

function elementTypeName(type: unknown): string {
  if (typeof type === "string") {
    return type;
  }
  if (typeof type === "function") {
    const component = type as { displayName?: string; name?: string };
    return component.displayName ?? component.name ?? "Unknown";
  }
  if (typeof type === "object" && type !== null && "type" in type) {
    return elementTypeName(type.type);
  }
  return "Unknown";
}

function summarizeTreeNode(node: unknown): Record<string, unknown> {
  const treeNode = node as {
    actualNode?: unknown;
    children?: unknown[] | null;
    constructor?: { name?: string };
    data?: unknown;
    drawableX?: number;
    drawableY?: number;
    nodeColor?: number;
    nodePos?: number;
  };
  const type = treeNode.constructor?.name ?? "Unknown";

  switch (type) {
    case "DataTreeNode":
      return { type, data: treeNode.data };
    case "AlreadyParsedTreeNode":
      return { type, actualNode: summarizeTreeNodeReference(treeNode.actualNode) };
    default:
      return summarizeTreeNodeReference(node);
  }
}

function summarizeTreeNodeReference(node: unknown): Record<string, unknown> {
  const treeNode = node as {
    children?: unknown[] | null;
    constructor?: { name?: string };
    drawableX?: number;
    drawableY?: number;
    nodeColor?: number;
    nodePos?: number;
  };
  return {
    type: treeNode.constructor?.name ?? "Unknown",
    childCount: treeNode.children?.length ?? 0,
    nodeColor: treeNode.nodeColor,
    nodePos: treeNode.nodePos,
    drawableX: treeNode.drawableX,
    drawableY: treeNode.drawableY,
  };
}

function snapshotValue(key: string, value: unknown): unknown {
  if (key === "nodes" && Array.isArray(value)) {
    return value.map(summarizeTreeNode);
  }
  if (isValidElement(value)) {
    return snapshotElement(value);
  }
  if (Array.isArray(value)) {
    return value.map(item => snapshotValue("", item));
  }
  if (typeof value === "function") {
    return `[Function ${value.name}]`;
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        snapshotValue(childKey, childValue),
      ]),
    );
  }
  return value;
}

function snapshotProps(props: Record<string, unknown>): Record<string, unknown> | undefined {
  const entries = Object.entries(props)
    .filter(([key]) => key !== "children")
    .map(([key, value]) => [key, snapshotValue(key, value)] as const);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function snapshotElement(element: ReactElement): DrawableSnapshot {
  const props = element.props as Record<string, unknown>;
  const children = Children.toArray(props.children as ReactNode).map(child =>
    isValidElement(child) ? snapshotElement(child) : child,
  );
  const snapshot: DrawableSnapshot = {
    type: elementTypeName(element.type),
  };

  if (element.key != null) {
    snapshot.key = "" + element.key;
  }

  const propsSnapshot = snapshotProps(props);
  if (propsSnapshot !== undefined) {
    snapshot.props = propsSnapshot;
  }

  if (children.length > 0) {
    snapshot.children = children;
  }

  return snapshot;
}

function snapshotDrawingDrawables(drawing: ReactElement) {
  const stageProps = drawing.props as Record<string, unknown>;
  const layer = Children.toArray(stageProps.children as ReactNode)[0];
  if (!isValidElement(layer)) {
    throw new Error("Expected drawing stage to contain a Konva layer");
  }

  const layerProps = layer.props as Record<string, unknown>;
  return {
    stage: snapshotProps(stageProps),
    layer: snapshotProps(layerProps),
    drawables: Children.toArray(layerProps.children as ReactNode).map(child => {
      if (!isValidElement(child)) {
        throw new Error("Expected drawer drawable to be a React element");
      }
      return snapshotElement(child);
    }),
  };
}
test("loading screen (english)", () => {
  const result = makeDataVisualizerTabFrom("playground", MOCK_CONFIG).body;
  const { container } = render(result);
  expect(container).toMatchSnapshot();
});

test("actual konva drawables", async () => {
  const result = await new Promise<Step[]>(resolve => {
    DataVisualizer.init(steps => {
      if (steps.length == 3) {
        resolve(steps);
      }
    });
    DataVisualizer.drawData([["1", "2"]]);
    DataVisualizer.drawData([[null]]);
    const arr: Data[] = [1, 2];
    arr[1] = arr;
    DataVisualizer.drawData([arr]);
  });
  const drawables = result.map(step => step.map(snapshotDrawingDrawables));
  expect(drawables).toMatchSnapshot();
});
