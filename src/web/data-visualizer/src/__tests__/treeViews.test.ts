import type { SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";
import { describe, expect, test, vi } from "vitest";

// Same rationale as tree.test.ts: avoid Konva's Node-environment build requiring the optional
// `canvas` package for what are, here, pure layout-arithmetic and warning-fallback checks.
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

import { Text } from "react-konva";

import { Tree } from "../tree/Tree";
import { BinaryTreeDrawer } from "../tree/BinaryTreeDrawer";
import { GeneralTreeDrawer } from "../tree/GeneralTreeDrawer";

const empty = (): SerializedDataVisualizerNode => ({ type: "empty" });
const leaf = (n: number): SerializedDataVisualizerNode => ({
  type: "leaf",
  displayValue: String(n),
  label: "number",
});
let nextRefId = 1;
const pair = (
  a: SerializedDataVisualizerNode,
  b: SerializedDataVisualizerNode,
): SerializedDataVisualizerNode => ({ type: "array", refId: nextRefId++, children: [a, b] });

// SICP `list(data, left, right)` encoding — see classify.test.ts for the same helper's rationale.
const binaryNode = (
  n: number,
  left: SerializedDataVisualizerNode = empty(),
  right: SerializedDataVisualizerNode = empty(),
): SerializedDataVisualizerNode => pair(leaf(n), pair(left, pair(right, empty())));

const generalNode = (
  n: number,
  ...children: SerializedDataVisualizerNode[]
): SerializedDataVisualizerNode => {
  if (children.length === 0) {
    return pair(leaf(n), empty());
  }
  const childrenList = children.reduceRight<SerializedDataVisualizerNode>(
    (acc, c) => pair(c, acc),
    empty(),
  );
  return pair(leaf(n), pair(childrenList, empty()));
};

describe("BinaryTreeDrawer", () => {
  test("a non-binary-tree structure draws the fixed-size warning box instead of a tree", () => {
    const tree = Tree.fromSerializedNode(pair(leaf(1), leaf(2)));
    const drawer = tree.draw("binaryTree") as BinaryTreeDrawer;
    const element = drawer.draw(0, 0, 0) as React.ReactElement<{
      width: number;
      height: number;
      children: React.ReactElement<{ children: React.ReactElement<{ text: string }> }>;
    }>;
    expect(element.props.width).toBe(490);
    expect(element.props.height).toBe(100);
    const text = element.props.children.props.children;
    expect(text.type).toBe(Text);
    expect(text.props.text).toBe("Binary Tree View only supports binary trees (no cycles)");
  });

  test("a single-node binary tree draws without throwing, to a positive finite size", () => {
    const tree = Tree.fromSerializedNode(binaryNode(1));
    const drawer = tree.draw("binaryTree") as BinaryTreeDrawer;
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBeGreaterThan(0);
    expect(drawer.height).toBeGreaterThan(0);
    expect(Number.isFinite(drawer.width)).toBe(true);
    expect(Number.isFinite(drawer.height)).toBe(true);
  });

  test("a deeper binary tree draws without throwing, wider and taller than a single node", () => {
    const single = Tree.fromSerializedNode(binaryNode(1)).draw("binaryTree") as BinaryTreeDrawer;
    single.draw(0, 0, 0);

    const deep = Tree.fromSerializedNode(
      binaryNode(1, binaryNode(2, binaryNode(4), binaryNode(5)), binaryNode(3)),
    ).draw("binaryTree") as BinaryTreeDrawer;
    expect(() => deep.draw(0, 0, 0)).not.toThrow();
    expect(deep.width).toBeGreaterThan(single.width);
    expect(deep.height).toBeGreaterThan(single.height);
  });

  test("the bare empty terminator is a trivial valid binary tree, drawn via the measured-text branch", () => {
    // Per isBinaryTreeNode: a binary tree is `null`, or a 3-element list — a bare *leaf* value is
    // neither, so (unlike this case) it fails classification and hits the warning box instead.
    const tree = Tree.fromSerializedNode(empty());
    const drawer = tree.draw("binaryTree") as BinaryTreeDrawer;
    drawer.draw(0, 0, 0);
    // Per the mocked Konva.Text in the shared mock above.
    expect(drawer.width).toBe(40);
    expect(drawer.height).toBe(25);
  });
});

describe("GeneralTreeDrawer", () => {
  test("a non-general-tree structure draws the fixed-size warning box instead of a tree", () => {
    // An *improper* list (here, a bare 2-tuple whose second slot is a leaf rather than another pair
    // or the empty terminator) is the only shape General Tree View actually rejects — a binary-tree-
    // shaped input is itself a valid (proper-list) general tree, see classify.test.ts.
    const tree = Tree.fromSerializedNode(pair(leaf(1), leaf(2)));
    const drawer = tree.draw("generalTree") as GeneralTreeDrawer;
    const element = drawer.draw(0, 0, 0) as React.ReactElement<{
      width: number;
      height: number;
      children: React.ReactElement<{ children: React.ReactElement<{ text: string }> }>;
    }>;
    expect(element.props.width).toBe(445);
    expect(element.props.height).toBe(100);
    const text = element.props.children.props.children;
    expect(text.type).toBe(Text);
    expect(text.props.text).toBe("General Tree View only supports trees (no cycles)");
  });

  test("a childless general tree node draws without throwing, to a positive finite size", () => {
    const tree = Tree.fromSerializedNode(generalNode(1));
    const drawer = tree.draw("generalTree") as GeneralTreeDrawer;
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBeGreaterThan(0);
    expect(drawer.height).toBeGreaterThan(0);
    expect(Number.isFinite(drawer.width)).toBe(true);
    expect(Number.isFinite(drawer.height)).toBe(true);
  });

  test("more siblings draw wider, without throwing", () => {
    const two = Tree.fromSerializedNode(generalNode(1, generalNode(2), generalNode(3))).draw(
      "generalTree",
    ) as GeneralTreeDrawer;
    two.draw(0, 0, 0);

    const four = Tree.fromSerializedNode(
      generalNode(1, generalNode(2), generalNode(3), generalNode(4), generalNode(5)),
    ).draw("generalTree") as GeneralTreeDrawer;
    expect(() => four.draw(0, 0, 1)).not.toThrow();
    expect(four.width).toBeGreaterThan(two.width);
  });

  test("a flat llist-style general tree (label directly followed by compound children) draws without throwing", () => {
    // llist(1, llist(2, None, None), llist(3, None, None)) — see classify.test.ts for why this is a
    // valid general tree despite not using the nested-children-list encoding `generalNode` builds.
    const leafTree = (n: number): SerializedDataVisualizerNode =>
      pair(leaf(n), pair(empty(), pair(empty(), empty())));
    const tree = Tree.fromSerializedNode(
      pair(leaf(1), pair(leafTree(2), pair(leafTree(3), empty()))),
    );
    const drawer = tree.draw("generalTree") as GeneralTreeDrawer;
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBeGreaterThan(0);
    expect(drawer.height).toBeGreaterThan(0);
  });
});

describe("Tree.draw view mode dispatch", () => {
  test("returns the matching drawer instance for each view mode", () => {
    const tree = Tree.fromSerializedNode(leaf(1));
    expect(tree.draw("binaryTree")).toBeInstanceOf(BinaryTreeDrawer);
    expect(tree.draw("generalTree")).toBeInstanceOf(GeneralTreeDrawer);
  });
});
