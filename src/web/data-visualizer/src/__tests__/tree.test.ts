import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";
import { describe, expect, test, vi } from "vitest";

// These tests exercise pure layout arithmetic (getNodeWidth/getNodeHeight, arrow routing), never
// actually rendering to a canvas — but importing the real `konva`/`react-konva` still runs their
// module-init code, which detects vitest's Node environment (no `window`) and switches to Konva's
// server-side build, which unconditionally `require`s the optional `canvas` native package. Mock
// both so the import graph resolves without needing that dependency; only `Konva.Text` needs any
// real shape, and only because `OriginalDrawer` references it (unused by the array/pair trees these
// tests build).
vi.mock("konva", () => ({ default: { Text: class {} } }));
vi.mock("react-konva", () => {
  const stub = () => null;
  return {
    Stage: stub,
    Layer: stub,
    Text: stub,
    Group: stub,
    Line: stub,
    Rect: stub,
    Circle: stub,
    Arrow: stub,
  };
});

import { Config } from "../Config";
import { AlreadyParsedTreeNode } from "../tree/AlreadyParsedTreeNode";
import { OriginalDrawer } from "../tree/OriginalDrawer";
import { Tree } from "../tree/Tree";
import { ArrayTreeNode } from "../tree/TreeNode";

const leaf = (displayValue: string): SerializedDataVisualizerNode => ({
  type: "leaf",
  displayValue,
  label: "number",
});

describe("Tree.fromSerializedNode", () => {
  test("builds a plain array of leaves with no sharing", () => {
    const tree = Tree.fromSerializedNode({
      type: "array",
      refId: 1,
      children: [leaf("1"), leaf("2")],
    });

    const root = tree.rootNode as ArrayTreeNode;
    expect(root).toBeInstanceOf(ArrayTreeNode);
    expect(root.children).toHaveLength(2);
  });

  test("a self-referential array resolves its own ref to an AlreadyParsedTreeNode wrapping itself", () => {
    // Wire form of `x = []; x.append(x)`: the array's only child is a "ref" back to its own refId.
    const selfRef: SerializedDataVisualizerNode = { type: "array", refId: 1, children: [] };
    (selfRef as { children: SerializedDataVisualizerNode[] }).children = [
      { type: "ref", refId: 1 },
    ];

    const tree = Tree.fromSerializedNode(selfRef);
    const root = tree.rootNode as ArrayTreeNode;

    expect(root.children).toHaveLength(1);
    const child = root.children![0];
    expect(child).toBeInstanceOf(AlreadyParsedTreeNode);
    // The cycle must resolve back to the very same node instance, not a copy — otherwise the
    // drawer would treat it as a second, unlinked structure instead of an arrow back to the root.
    expect((child as AlreadyParsedTreeNode).actualNode).toBe(root);
  });

  test("two refs to the same non-cyclic array share one node instance, not two separate ones", () => {
    // Wire form of `x1 = [1]; x2 = [x1, x1]` — x1 appears twice in one row but was never cyclic.
    const shared: SerializedDataVisualizerNode = { type: "array", refId: 1, children: [leaf("1")] };
    const tree = Tree.fromSerializedNode({
      type: "array",
      refId: 2,
      children: [shared, { type: "ref", refId: 1 }],
    });

    const root = tree.rootNode as ArrayTreeNode;
    const [first, second] = root.children!;
    expect(first).toBeInstanceOf(ArrayTreeNode);
    expect(second).toBeInstanceOf(AlreadyParsedTreeNode);
    expect((second as AlreadyParsedTreeNode).actualNode).toBe(first);
  });

  test("an unresolved ref (malformed message) falls back to empty instead of throwing", () => {
    const tree = Tree.fromSerializedNode({ type: "ref", refId: 999 });
    expect(tree.rootNode).toMatchObject({ isEmpty: true });
  });
});

describe("OriginalDrawer pixel math", () => {
  test("a plain pair of two leaves sizes to two boxes side by side, no arrows", () => {
    const tree = Tree.fromSerializedNode({
      type: "array",
      refId: 1,
      children: [leaf("1"), leaf("2")],
    });
    const drawer = new OriginalDrawer(tree);
    drawer.draw(0, 0, 0);

    expect(drawer.width).toBe(2 * Config.BoxWidth + Config.StrokeWidth);
    expect(drawer.height).toBe(Config.BoxHeight + Config.StrokeWidth);
  });

  test("a self-referential array terminates and routes a backward arrow instead of recursing forever", () => {
    const selfRef: SerializedDataVisualizerNode = { type: "array", refId: 1, children: [] };
    (selfRef as { children: SerializedDataVisualizerNode[] }).children = [
      { type: "ref", refId: 1 },
    ];
    const tree = Tree.fromSerializedNode(selfRef);
    const drawer = new OriginalDrawer(tree);

    // The real regression this guards: getNodeWidth/getNodeHeight recursing straight through an
    // AlreadyParsedTreeNode into its actualNode's own children would never terminate on a cycle.
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();

    // Hand-traced: a 1-child array box is BoxWidth+StrokeWidth wide and BoxHeight tall before
    // accounting for the arrow; the self-loop is necessarily a *backward* arrow (its target, the
    // root, is drawn at the same y it points from), which pushes minX/minY out by
    // ArrowMarginHorizontal/Top + StrokeWidth/2 in the negative direction.
    const nodeWidth = Config.BoxWidth + Config.StrokeWidth;
    const nodeHeight = Config.ArrowMarginBottom + Config.BoxHeight;
    const minShift = Config.ArrowMarginHorizontal + Config.StrokeWidth / 2;
    expect(drawer.width).toBe(nodeWidth + minShift);
    expect(drawer.height).toBe(nodeHeight + minShift + Config.StrokeWidth);
  });

  test("a shared-but-acyclic structure draws as a normal forward arrow (no backward-arrow offset)", () => {
    const shared: SerializedDataVisualizerNode = { type: "array", refId: 1, children: [leaf("1")] };
    const tree = Tree.fromSerializedNode({
      type: "array",
      refId: 2,
      children: [shared, { type: "ref", refId: 1 }],
    });
    const drawer = new OriginalDrawer(tree);
    drawer.draw(0, 0, 0);

    // Sharing without a cycle must NOT trip the backward-arrow path: the referenced node is drawn
    // further down (child of the first slot), so the ref arrow always points forward/downward.
    expect(drawer.width).toBe(2 * Config.BoxWidth + Config.StrokeWidth);
    // Two box-heights stacked (root over its one real child) plus half the vertical spacing the
    // child is drawn at, plus the stroke margin — no backward-arrow offset mixed in.
    expect(drawer.height).toBe(2 * Config.BoxHeight + Config.DistanceY / 2 + Config.StrokeWidth);
  });

  test("width grows with sibling count and height grows with nesting depth", () => {
    const two = new OriginalDrawer(
      Tree.fromSerializedNode({ type: "array", refId: 1, children: [leaf("1"), leaf("2")] }),
    );
    const three = new OriginalDrawer(
      Tree.fromSerializedNode({
        type: "array",
        refId: 1,
        children: [leaf("1"), leaf("2"), leaf("3")],
      }),
    );
    two.draw(0, 0, 0);
    three.draw(0, 0, 1);
    expect(three.width).toBeGreaterThan(two.width);

    const flat = new OriginalDrawer(
      Tree.fromSerializedNode({ type: "array", refId: 1, children: [leaf("1")] }),
    );
    const nested = new OriginalDrawer(
      Tree.fromSerializedNode({
        type: "array",
        refId: 1,
        children: [{ type: "array", refId: 2, children: [leaf("1")] }],
      }),
    );
    flat.draw(0, 0, 0);
    nested.draw(0, 0, 1);
    expect(nested.height).toBeGreaterThan(flat.height);
  });
});
