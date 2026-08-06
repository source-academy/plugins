import type { SerializedDataVisualizerNode } from '@sourceacademy/common-data-visualizer';
import { describe, expect, test, vi } from 'vitest';

// Same rationale as tree.test.ts: avoid Konva's Node-environment build requiring the optional
// `canvas` package for what are, here, pure layout-arithmetic and warning-fallback checks.
vi.mock(
  import('konva'),
  () =>
    ({
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
    }) as any,
);

vi.mock(import('react-konva'), () => {
  const stub = (name: string) => {
    const fn = () => null;
    Object.defineProperty(fn, 'name', { value: name });
    return fn;
  };
  return {
    Stage: stub('Stage'),
    Layer: stub('Layer'),
    Text: stub('Text'),
    Group: stub('Group'),
    Line: stub('Line'),
    Rect: stub('Rect'),
    Circle: stub('Circle'),
    Arrow: stub('Arrow'),
  } as any;
});

import { Text } from 'react-konva';

import type { ClassificationResult } from '../classify';
import { ArrowDrawable, BackwardArrowDrawable } from '../drawable/Drawable';
import { AlreadyParsedTreeNode } from '../tree/AlreadyParsedTreeNode';
import { BinaryTreeDrawer } from '../tree/BinaryTreeDrawer';
import { GeneralTreeDrawer } from '../tree/GeneralTreeDrawer';
import { Tree } from '../tree/Tree';
import { ArrayTreeNode, FunctionTreeNode } from '../tree/TreeNode';

const empty = (): SerializedDataVisualizerNode => ({ type: 'empty' });
const leaf = (n: number): SerializedDataVisualizerNode => ({
  type: 'leaf',
  displayValue: String(n),
  label: 'number',
});
let nextRefId = 1;
const pair = (
  a: SerializedDataVisualizerNode,
  b: SerializedDataVisualizerNode,
): SerializedDataVisualizerNode => ({ type: 'array', refId: nextRefId++, children: [a, b] });

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

// A fully-satisfied ClassificationResult, for constructing a drawer directly rather than via
// Tree.fromSerializedNode + classify(). Used only by the drawNode direct-construction tests below.
const fakeClassification = (): ClassificationResult => ({
  isCyclic: false,
  isSharedStructure: false,
  isBinaryTree: true,
  isGeneralTree: true,
});

// drawNode, minX/minY and drawables are `protected` - real callers only ever reach drawNode via the
// public draw(), which is exactly what the direct-construction tests below intentionally bypass (see
// their shared comment). This is the one place that needs to reach past that.
type DrawerInternals = {
  drawNode: (
    node: AlreadyParsedTreeNode | FunctionTreeNode,
    x: number,
    y: number,
    parentX: number,
    parentY: number,
    colorIndex: number,
    parentIndex: number,
    originIndex: number,
    originX: number,
  ) => void;
  drawables: React.ReactElement[];
  minX: number;
  minY: number;
};
const internals = (drawer: BinaryTreeDrawer | GeneralTreeDrawer): DrawerInternals =>
  drawer as DrawerInternals;

describe('BinaryTreeDrawer', () => {
  test('a non-binary-tree structure draws the fixed-size warning box instead of a tree', () => {
    const tree = Tree.fromSerializedNode(pair(leaf(1), leaf(2)));
    const drawer = tree.draw('binaryTree') as BinaryTreeDrawer;
    const element = drawer.draw(0, 0, 0) as React.ReactElement<{
      width: number;
      height: number;
      children: React.ReactElement<{ children: React.ReactElement<{ text: string }> }>;
    }>;
    expect(element.props.width).toBe(490);
    expect(element.props.height).toBe(100);
    const text = element.props.children.props.children;
    expect(text.type).toBe(Text);
    expect(text.props.text).toBe('Binary Tree View only supports binary trees (no cycles)');
  });

  test('a single-node binary tree draws without throwing, to a positive finite size', () => {
    const tree = Tree.fromSerializedNode(binaryNode(1));
    const drawer = tree.draw('binaryTree') as BinaryTreeDrawer;
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBeGreaterThan(0);
    expect(drawer.height).toBeGreaterThan(0);
    expect(Number.isFinite(drawer.width)).toBe(true);
    expect(Number.isFinite(drawer.height)).toBe(true);
  });

  test('a deeper binary tree draws without throwing, wider and taller than a single node', () => {
    const single = Tree.fromSerializedNode(binaryNode(1)).draw('binaryTree') as BinaryTreeDrawer;
    single.draw(0, 0, 0);

    const deep = Tree.fromSerializedNode(
      binaryNode(1, binaryNode(2, binaryNode(4), binaryNode(5)), binaryNode(3)),
    ).draw('binaryTree') as BinaryTreeDrawer;
    expect(() => deep.draw(0, 0, 0)).not.toThrow();
    expect(deep.width).toBeGreaterThan(single.width);
    expect(deep.height).toBeGreaterThan(single.height);
  });

  test('the bare empty terminator is a trivial valid binary tree, drawn via the measured-text branch', () => {
    // Per isBinaryTreeNode: a binary tree is `null`, or a 3-element list — a bare *leaf* value is
    // neither, so (unlike this case) it fails classification and hits the warning box instead.
    const tree = Tree.fromSerializedNode(empty());
    const drawer = tree.draw('binaryTree') as BinaryTreeDrawer;
    drawer.draw(0, 0, 0);
    // Per the mocked Konva.Text in the shared mock above.
    expect(drawer.width).toBe(40);
    expect(drawer.height).toBe(25);
  });

  // The tests below construct a Tree/classification directly rather than via
  // Tree.fromSerializedNode + classify(), and call drawNode directly rather than through draw().
  // That's not just a shortcut: it's the only way to reach these branches at all. Any
  // AlreadyParsedTreeNode implies classify()'s isSharedStructure, which always forces
  // isBinaryTree to false - so through the real Tree.fromSerializedNode(...).draw("binaryTree")
  // path, draw()'s own warning-box check (tested above) short-circuits before drawNode ever runs.
  // The cycle-arrow logic below is still real, hand-ported code (see this PR's description) - just
  // unreachable via the one entry point the rest of the app actually uses. These tests exist to
  // protect it from silent regression anyway.
  test('a forward reference to an earlier-drawn node draws a forward ArrowDrawable', () => {
    const target = new ArrayTreeNode();
    target.drawableX = 500;
    target.drawableY = 500; // "already drawn" further down/right than the reference site below
    const ref = new AlreadyParsedTreeNode(target);
    const tree = new Tree(ref, [], fakeClassification());
    const drawer = new BinaryTreeDrawer(tree, fakeClassification());

    internals(drawer).drawNode(ref, 0, 0, 0, 0, 0, 0, 0, 0); // parentY=0 < target.drawableY=500

    const { drawables } = internals(drawer);
    expect(drawables).toHaveLength(1);
    expect(drawables[0].type).toBe(ArrowDrawable);
  });

  test('a backward reference to an earlier-drawn node draws a BackwardArrowDrawable and pulls minX/minY negative', () => {
    const target = new ArrayTreeNode();
    target.drawableX = -50;
    target.drawableY = -50; // "already drawn" above/left of the reference site below
    const ref = new AlreadyParsedTreeNode(target);
    const tree = new Tree(ref, [], fakeClassification());
    const drawer = new BinaryTreeDrawer(tree, fakeClassification());

    internals(drawer).drawNode(ref, 500, 500, 500, 500, 0, 0, 0, 0); // parentY=500 >= target.drawableY=-50

    const { drawables } = internals(drawer);
    expect(drawables).toHaveLength(1);
    expect(drawables[0].type).toBe(BackwardArrowDrawable);
    expect(internals(drawer).minX).toBeLessThan(0);
    expect(internals(drawer).minY).toBeLessThan(0);
  });

  test('a function-value node draws its own content via createDrawable', () => {
    const fn = new FunctionTreeNode();
    const tree = new Tree(fn, [], fakeClassification());
    const drawer = new BinaryTreeDrawer(tree, fakeClassification());

    expect(() => internals(drawer).drawNode(fn, 10, 10, 0, 0, 0, 0, 0, 0)).not.toThrow();
    expect(internals(drawer).drawables).toHaveLength(1);
    expect(fn.drawableX).toBe(10);
    expect(fn.drawableY).toBe(10);
  });
});

describe('GeneralTreeDrawer', () => {
  test('a non-general-tree structure draws the fixed-size warning box instead of a tree', () => {
    // An *improper* list (here, a bare 2-tuple whose second slot is a leaf rather than another pair
    // or the empty terminator) is the only shape General Tree View actually rejects — a binary-tree-
    // shaped input is itself a valid (proper-list) general tree, see classify.test.ts.
    const tree = Tree.fromSerializedNode(pair(leaf(1), leaf(2)));
    const drawer = tree.draw('generalTree') as GeneralTreeDrawer;
    const element = drawer.draw(0, 0, 0) as React.ReactElement<{
      width: number;
      height: number;
      children: React.ReactElement<{ children: React.ReactElement<{ text: string }> }>;
    }>;
    expect(element.props.width).toBe(445);
    expect(element.props.height).toBe(100);
    const text = element.props.children.props.children;
    expect(text.type).toBe(Text);
    expect(text.props.text).toBe('General Tree View only supports trees (no cycles)');
  });

  test('a childless general tree node draws without throwing, to a positive finite size', () => {
    const tree = Tree.fromSerializedNode(generalNode(1));
    const drawer = tree.draw('generalTree') as GeneralTreeDrawer;
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBeGreaterThan(0);
    expect(drawer.height).toBeGreaterThan(0);
    expect(Number.isFinite(drawer.width)).toBe(true);
    expect(Number.isFinite(drawer.height)).toBe(true);
  });

  test('more siblings draw wider, without throwing', () => {
    const two = Tree.fromSerializedNode(generalNode(1, generalNode(2), generalNode(3))).draw(
      'generalTree',
    ) as GeneralTreeDrawer;
    two.draw(0, 0, 0);

    const four = Tree.fromSerializedNode(
      generalNode(1, generalNode(2), generalNode(3), generalNode(4), generalNode(5)),
    ).draw('generalTree') as GeneralTreeDrawer;
    expect(() => four.draw(0, 0, 1)).not.toThrow();
    expect(four.width).toBeGreaterThan(two.width);
  });

  test('the bare empty terminator is a trivial valid general tree, drawn via the measured-text branch', () => {
    // Mirrors BinaryTreeDrawer's equivalent test above: isGeneralTreeNode({type:"empty"}) is true,
    // same as isBinaryTreeNode, so this hits GeneralTreeDrawer's own DataTreeNode/measured-text
    // branch rather than the warning box.
    const tree = Tree.fromSerializedNode(empty());
    const drawer = tree.draw('generalTree') as GeneralTreeDrawer;
    drawer.draw(0, 0, 0);
    expect(drawer.width).toBe(40);
    expect(drawer.height).toBe(25);
  });

  test('a flat llist-style general tree (label directly followed by compound children) draws without throwing', () => {
    // llist(1, llist(2, None, None), llist(3, None, None)) — see classify.test.ts for why this is a
    // valid general tree despite not using the nested-children-list encoding `generalNode` builds.
    const leafTree = (n: number): SerializedDataVisualizerNode =>
      pair(leaf(n), pair(empty(), pair(empty(), empty())));
    const tree = Tree.fromSerializedNode(
      pair(leaf(1), pair(leafTree(2), pair(leafTree(3), empty()))),
    );
    const drawer = tree.draw('generalTree') as GeneralTreeDrawer;
    expect(() => drawer.draw(0, 0, 0)).not.toThrow();
    expect(drawer.width).toBeGreaterThan(0);
    expect(drawer.height).toBeGreaterThan(0);
  });

  // Same rationale as BinaryTreeDrawer's direct-construction tests above: any AlreadyParsedTreeNode
  // implies isSharedStructure, which always forces isGeneralTree to false too, so these branches of
  // drawNode are otherwise unreachable via the real Tree.fromSerializedNode(...).draw("generalTree")
  // path. GeneralTreeDrawer hand-ports this logic separately from BinaryTreeDrawer (it's a distinct
  // class, not a shared base method), so it gets its own copy of these tests rather than assuming
  // "BinaryTreeDrawer passing" implies this one is also transcribed correctly.
  test('a forward reference to an earlier-drawn node draws a forward ArrowDrawable', () => {
    const target = new ArrayTreeNode();
    target.drawableX = 500;
    target.drawableY = 500;
    const ref = new AlreadyParsedTreeNode(target);
    const tree = new Tree(ref, [], fakeClassification());
    const drawer = new GeneralTreeDrawer(tree, fakeClassification());

    internals(drawer).drawNode(ref, 0, 0, 0, 0, 0, 0, 0, 0);

    const { drawables } = internals(drawer);
    expect(drawables).toHaveLength(1);
    expect(drawables[0].type).toBe(ArrowDrawable);
  });

  test('a backward reference to an earlier-drawn node draws a BackwardArrowDrawable and pulls minX/minY negative', () => {
    const target = new ArrayTreeNode();
    target.drawableX = -50;
    target.drawableY = -50;
    const ref = new AlreadyParsedTreeNode(target);
    const tree = new Tree(ref, [], fakeClassification());
    const drawer = new GeneralTreeDrawer(tree, fakeClassification());

    internals(drawer).drawNode(ref, 500, 500, 500, 500, 0, 0, 0, 0);

    const { drawables } = internals(drawer);
    expect(drawables).toHaveLength(1);
    expect(drawables[0].type).toBe(BackwardArrowDrawable);
    expect(internals(drawer).minX).toBeLessThan(0);
    expect(internals(drawer).minY).toBeLessThan(0);
  });

  test('a function-value node draws its own content via createDrawable', () => {
    const fn = new FunctionTreeNode();
    const tree = new Tree(fn, [], fakeClassification());
    const drawer = new GeneralTreeDrawer(tree, fakeClassification());

    expect(() => internals(drawer).drawNode(fn, 10, 10, 0, 0, 0, 0, 0, 0)).not.toThrow();
    expect(internals(drawer).drawables).toHaveLength(1);
    expect(fn.drawableX).toBe(10);
    expect(fn.drawableY).toBe(10);
  });
});

describe('Tree.draw view mode dispatch', () => {
  test('returns the matching drawer instance for each view mode', () => {
    const tree = Tree.fromSerializedNode(leaf(1));
    expect(tree.draw('binaryTree')).toBeInstanceOf(BinaryTreeDrawer);
    expect(tree.draw('generalTree')).toBeInstanceOf(GeneralTreeDrawer);
  });
});
