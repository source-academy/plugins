import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";
import { describe, expect, test, vi } from "vitest";

// These tests exercise layout arithmetic and presentational branching, never actually rendering
// to a canvas — but importing the real `konva`/`react-konva` still runs their module-init code,
// which detects vitest's Node environment (no `window`) and switches to Konva's server-side
// build, which unconditionally `require`s the optional `canvas` native package. Mock both so the
// import graph resolves without needing that dependency. Each react-konva primitive gets its own
// stub function (rather than one shared stub) so tests can assert *which* primitive a component
// rendered, not just that it rendered something. `Konva.Text` gets a fixed fake size — real text
// measurement needs a canvas, and these tests only check the arithmetic built on top of it.
vi.mock("konva", () => ({
  default: {
    Text: class {
      width() {
        return 40;
      }
      height() {
        return 25;
      }
    },
  },
}));
vi.mock("react-konva", () => {
  const stub = (name: string) => {
    const fn = () => null;
    Object.defineProperty(fn, "name", { value: name });
    return fn;
  };
  return {
    Stage: stub("Stage"),
    Layer: stub("Layer"),
    Text: stub("Text"),
    Group: stub("Group"),
    Line: stub("Line"),
    Rect: stub("Rect"),
    Circle: stub("Circle"),
    Arrow: stub("Arrow"),
  };
});

import { Group, Line, Rect, Text } from "react-konva";

import { Config } from "../Config";
import { NullDrawable } from "../drawable/Drawable";
import ArrayDrawable from "../drawable/ArrayDrawable";
import { formatLeaf } from "../format";
import { AlreadyParsedTreeNode } from "../tree/AlreadyParsedTreeNode";
import { OriginalDrawer } from "../tree/OriginalDrawer";
import { Tree } from "../tree/Tree";
import { ArrayTreeNode, DataTreeNode, FunctionTreeNode, TreeNode } from "../tree/TreeNode";

const leaf = (displayValue: string): SerializedDataVisualizerNode => ({
  type: "leaf",
  displayValue,
  label: "number",
});

const func = (refId: number): SerializedDataVisualizerNode => ({
  type: "function",
  refId,
  displayValue: "function foo",
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

  test("builds a function node, and two refs to the same function share one instance", () => {
    const tree = Tree.fromSerializedNode({
      type: "array",
      refId: 2,
      children: [func(1), { type: "ref", refId: 1 }],
    });

    const root = tree.rootNode as ArrayTreeNode;
    const [first, second] = root.children!;
    expect(first).toBeInstanceOf(FunctionTreeNode);
    expect(second).toBeInstanceOf(AlreadyParsedTreeNode);
    expect((second as AlreadyParsedTreeNode).actualNode).toBe(first);
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

describe("Tree.getNodeById", () => {
  test("id 0 is always the root array/function node", () => {
    const tree = Tree.fromSerializedNode({
      type: "array",
      refId: 1,
      children: [leaf("1"), leaf("2")],
    });
    expect(tree.getNodeById(0)).toBe(tree.rootNode);
  });

  test("later ids are assigned to nested array/function nodes in construction order", () => {
    const tree = Tree.fromSerializedNode({
      type: "array",
      refId: 1,
      children: [{ type: "array", refId: 2, children: [leaf("1")] }, leaf("2")],
    });
    const root = tree.rootNode as ArrayTreeNode;
    // The nested array is the only other array/function node, built (and given id 1) while still
    // inside the root's own construction — before the root's outer call returns.
    expect(tree.getNodeById(1)).toBe(root.children![0]);
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

  test("a bare leaf (no pair/array at all) sizes from the measured text, not the box grid", () => {
    // e.g. `draw_data(1, 42)` — a value1 with no compound structure takes OriginalDrawer's
    // separate DataTreeNode-root branch (Konva.Text measurement), not drawNode's box-grid math.
    const tree = Tree.fromSerializedNode(leaf("42"));
    const drawer = new OriginalDrawer(tree);
    // x/y only offset the returned <Stage>'s own width/height props (`this.width + x`), not the
    // drawer's public `.width`/`.height` fields — same as the compound-tree branch below, where
    // `.width`/`.height` are `getNodeWidth(root) - minX` with no x/y term either. Passing non-zero
    // x/y here (rather than the 0/0 every other test uses) makes that distinction observable.
    drawer.draw(3, 5, 0);

    // Per the mocked Konva.Text above.
    expect(drawer.width).toBe(40);
    expect(drawer.height).toBe(25);
  });

  test("Tree.draw('original') (the real entry point DataVisualizerView calls) returns an OriginalDrawer", () => {
    const node: SerializedDataVisualizerNode = {
      type: "array",
      refId: 1,
      children: [leaf("1"), leaf("2")],
    };
    const drawer = Tree.fromSerializedNode(node).draw("original");
    expect(drawer).toBeInstanceOf(OriginalDrawer);
    expect(() => drawer.draw(10, 10, 0)).not.toThrow();
    expect(drawer.draw(10, 10, 0)).toBeTruthy();
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
    // root, is drawn at the same y it points from), which pushes minX out by
    // ArrowMarginHorizontal+StrokeWidth/2 and minY out by ArrowMarginTop+StrokeWidth/2 (distinct
    // constants, matching OriginalDrawer's own minX/minY updates) in the negative direction.
    const nodeWidth = Config.BoxWidth + Config.StrokeWidth;
    const nodeHeight = Config.ArrowMarginBottom + Config.BoxHeight;
    const minXShift = Config.ArrowMarginHorizontal + Config.StrokeWidth / 2;
    const minYShift = Config.ArrowMarginTop + Config.StrokeWidth / 2;
    expect(drawer.width).toBe(nodeWidth + minXShift);
    expect(drawer.height).toBe(nodeHeight + minYShift + Config.StrokeWidth);
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

  test("a function value sizes by its circle radius, not the box grid", () => {
    const tree = Tree.fromSerializedNode({ type: "array", refId: 1, children: [func(2)] });
    const drawer = new OriginalDrawer(tree);
    drawer.draw(0, 0, 0);

    expect(drawer.width).toBe(Config.CircleRadiusLarge * 4 + 2 * Config.StrokeWidth);
    expect(drawer.height).toBe(2 * Config.BoxHeight + Config.DistanceY / 2 + Config.StrokeWidth);
  });

  test("a node of an unrecognized TreeNode subtype degrades to zero size rather than throwing", () => {
    // getNodeWidth/getNodeHeight both switch on concrete subtype (DataTreeNode, AlreadyParsedTreeNode,
    // FunctionTreeNode, ArrayTreeNode) with a final `else` for anything else. Tree.fromSerializedNode
    // never actually produces a bare TreeNode - the four constructNode branches always pick a
    // concrete subclass - so this can only happen via direct construction, same as this file's other
    // white-box tests. Worth pinning anyway: it's the fallback for any *future* subtype this drawer
    // doesn't know about yet, and "quietly render as zero-size" is the intended degradation, not a bug.
    const bareNode = new TreeNode();
    const tree = new Tree(bareNode, [], {
      isCyclic: false,
      isSharedStructure: false,
      isBinaryTree: false,
      isGeneralTree: false,
    });
    const drawer = new OriginalDrawer(tree);
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBe(0);
    // Not 0: draw() adds Config.StrokeWidth on top of getNodeHeight's result unconditionally, for
    // every tree regardless of shape - this pins getNodeHeight's own contribution at 0, not the
    // Stage's total height.
    expect(drawer.height).toBe(Config.StrokeWidth);
  });

  test("an ArrayTreeNode constructed without ever assigning .children sizes to zero width", () => {
    // Tree.fromSerializedNode always assigns .children immediately after constructing an
    // ArrayTreeNode (see the "array" case in constructNode), so this can only happen via direct
    // construction - but getNodeWidth's own `node.children != null` check means it's a real,
    // reachable branch of that method, not dead code, so it's worth pinning the same way.
    const bareArray = new ArrayTreeNode();
    const tree = new Tree(bareArray, [], {
      isCyclic: false,
      isSharedStructure: false,
      isBinaryTree: false,
      isGeneralTree: false,
    });
    const drawer = new OriginalDrawer(tree);
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBe(0);
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

describe("formatLeaf", () => {
  test("wraps and passes through short strings unchanged apart from quoting", () => {
    expect(formatLeaf("hi", "string")).toBe('"hi"');
  });

  test("truncates strings longer than MaxTextLength and appends an ellipsis", () => {
    const long = "a".repeat(Config.MaxTextLength + 5);
    const result = formatLeaf(long, "string");
    expect(result).toBe(`"${"a".repeat(Config.MaxTextLength)}..."`);
  });

  test("a string exactly at MaxTextLength is not truncated or given an ellipsis", () => {
    const exact = "a".repeat(Config.MaxTextLength);
    expect(formatLeaf(exact, "string")).toBe(`"${exact}"`);
  });

  test("non-string labels pass through as-is, unquoted", () => {
    expect(formatLeaf("42", "number")).toBe("42");
    expect(formatLeaf("True", "bool")).toBe("True");
  });
});

type ArrayDrawableOutput = React.ReactElement<{
  children: [
    React.ReactElement<{ width: number }>, // the outer Rect
    false | React.ReactElement[], // the vertical separator Lines, if any
    React.ReactElement<{ text?: string }>[], // one Text (leaf) or NullDrawable (empty) per element
  ];
}>;

describe("ArrayDrawable", () => {
  const render = (nodes: DataTreeNode[]): ArrayDrawableOutput =>
    new ArrayDrawable({ nodes, x: 0, y: 0, color: "black" }).render() as ArrayDrawableOutput;

  test("a zero-length array (an empty list) clamps to the minimum box width, not zero", () => {
    // Real, reachable case: `draw_data([])` — a native list with no elements.
    const [rect] = render([]).props.children;
    expect(rect.type).toBe(Rect);
    expect(rect.props.width).toBe(Config.BoxMinWidth);
  });

  test("draws one fewer separator line than the number of elements, and none for a single element", () => {
    const [, twoLines] = render([
      DataTreeNode.leaf("1", "number"),
      DataTreeNode.leaf("2", "number"),
    ]).props.children;
    expect(twoLines).toHaveLength(1);
    expect((twoLines as React.ReactElement[])[0].type).toBe(Line);

    const [, oneLine] = render([DataTreeNode.leaf("1", "number")]).props.children;
    expect(oneLine).toBe(false);
  });

  test("an empty child slot draws NullDrawable's slash, a non-empty slot draws formatted Text", () => {
    const [, , [emptySlot, leafSlot]] = render([
      DataTreeNode.empty(),
      DataTreeNode.leaf("hi", "string"),
    ]).props.children;
    expect(emptySlot.type).toBe(NullDrawable);
    expect(leafSlot.type).toBe(Text);
    expect(leafSlot.props.text).toBe('"hi"');
  });

  test("outer rectangle width scales with element count", () => {
    const [rect] = render([
      DataTreeNode.leaf("1", "number"),
      DataTreeNode.leaf("2", "number"),
      DataTreeNode.leaf("3", "number"),
    ]).props.children;
    expect(rect.type).toBe(Rect);
    expect(rect.props.width).toBe(Config.BoxWidth * 3);
  });
});

// Sanity check that the mocked react-konva primitives are distinguishable from each other, since
// the ArrayDrawable assertions above rely on that to tell Rect/Line/Text/Group apart.
test("mocked react-konva primitives are distinct", () => {
  expect(new Set([Group, Line, Rect, Text]).size).toBe(4);
});
