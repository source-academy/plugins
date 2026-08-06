import { expect, test } from 'vitest';

import type { SerializedDataVisualizerNode } from '@sourceacademy/common-data-visualizer';
import { classify } from '../classify';

let nextRefId = 1;
const empty = (): SerializedDataVisualizerNode => ({ type: 'empty' });
const leaf = (n: number): SerializedDataVisualizerNode => ({
  type: 'leaf',
  displayValue: String(n),
  label: 'number',
});
const pair = (
  a: SerializedDataVisualizerNode,
  b: SerializedDataVisualizerNode,
): SerializedDataVisualizerNode => ({ type: 'array', refId: nextRefId++, children: [a, b] });

// SICP `list(data, left, right)` encoding: `[data, [left, [right, <end>]]]`. `left`/`right` default
// to the empty terminator (no child) when omitted, matching how a leaf binary-tree node is encoded.
const binaryNode = (
  n: number,
  left: SerializedDataVisualizerNode = empty(),
  right: SerializedDataVisualizerNode = empty(),
): SerializedDataVisualizerNode => pair(leaf(n), pair(left, pair(right, empty())));

// SICP `list(data, list-of-children)` encoding. Childless when `children` is empty: `[data, <end>]`.
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

test('the empty terminator alone is a trivial binary and general tree, with no sharing or cycles', () => {
  const result = classify(empty());
  expect(result.isCyclic).toBe(false);
  expect(result.isSharedStructure).toBe(false);
  expect(result.isBinaryTree).toBe(true);
  expect(result.isGeneralTree).toBe(true);
});

test('a self-referential list is cyclic, and is neither kind of tree', () => {
  // a = [1, [2, a]] — a's own tail eventually points back to a.
  const cyclic: SerializedDataVisualizerNode = {
    type: 'array',
    refId: 1,
    children: [
      leaf(1),
      { type: 'array', refId: 2, children: [leaf(2), { type: 'ref', refId: 1 }] },
    ],
  };
  const result = classify(cyclic);
  expect(result.isCyclic).toBe(true);
  expect(result.isSharedStructure).toBe(true);
  expect(result.isBinaryTree).toBe(false);
  expect(result.isGeneralTree).toBe(false);
});

test('two branches referencing the same acyclic value are shared but not cyclic', () => {
  const shared = pair(leaf(9), empty());
  const sharedRef: SerializedDataVisualizerNode = {
    type: 'ref',
    refId: (shared as Extract<SerializedDataVisualizerNode, { type: 'array' }>).refId,
  };
  const diamond = pair(shared, pair(sharedRef, empty()));

  const result = classify(diamond);
  expect(result.isCyclic).toBe(false);
  expect(result.isSharedStructure).toBe(true);
  expect(result.isBinaryTree).toBe(false);
  expect(result.isGeneralTree).toBe(false);
});

test('a proper 3-node binary tree is classified as a binary tree, with layout for every array node', () => {
  const tree = binaryNode(2, binaryNode(1), binaryNode(3));
  const result = classify(tree);
  expect(result.isCyclic).toBe(false);
  expect(result.isSharedStructure).toBe(false);
  expect(result.isBinaryTree).toBe(true);
  expect(result.layout).toBeDefined();
  // 5 pair-nodes total: root + (1,'s 3-link chain) + (3's 3-link chain) — every one gets a position.
  expect(result.layout?.posByRefId.size).toBeGreaterThan(0);
});

test('a plain flat list of same-typed leaves is not a binary tree', () => {
  // [1, [2, [3, <end>]]] — a bare leaf where a binary-tree node expects a left subtree.
  const flatList = pair(leaf(1), pair(leaf(2), pair(leaf(3), empty())));
  const result = classify(flatList);
  expect(result.isBinaryTree).toBe(false);
});

test('a simple pair is neither a binary tree nor a general tree', () => {
  const result = classify(pair(leaf(1), leaf(2)));
  expect(result.isBinaryTree).toBe(false);
  expect(result.isGeneralTree).toBe(false);
});

test('a general tree with two childless children is classified as a general tree', () => {
  const tree = generalNode(1, generalNode(2), generalNode(3));
  const result = classify(tree);
  expect(result.isCyclic).toBe(false);
  expect(result.isSharedStructure).toBe(false);
  expect(result.isGeneralTree).toBe(true);
  expect(result.layout).toBeDefined();
});

test('a childless general tree node is valid on its own', () => {
  const result = classify(generalNode(1));
  expect(result.isGeneralTree).toBe(true);
});

test('a flat llist-style general tree (label followed directly by compound children, not a nested children-list) is classified as a general tree', () => {
  // llist(1, llist(2, None, None), llist(3, None, None)) => [1, [ [2,[None,[None,None]]], [ [3,[None,[None,None]]], <end> ] ]]
  const leafTree = (n: number): SerializedDataVisualizerNode =>
    pair(leaf(n), pair(empty(), pair(empty(), empty())));
  const tree = pair(leaf(1), pair(leafTree(2), pair(leafTree(3), empty())));
  const result = classify(tree);
  expect(result.isCyclic).toBe(false);
  expect(result.isSharedStructure).toBe(false);
  expect(result.isGeneralTree).toBe(true);
});

test('a flat list of plain leaves with no compound elements is a general tree', () => {
  const flatList = pair(leaf(1), pair(leaf(2), pair(leaf(3), empty())));
  expect(classify(flatList).isGeneralTree).toBe(true);
});

test('a valid binary tree is also a valid general tree — Binary Tree View is a strict subset, not a disjoint shape', () => {
  const tree = binaryNode(2, binaryNode(1), binaryNode(3));
  const result = classify(tree);
  expect(result.isBinaryTree).toBe(true);
  expect(result.isGeneralTree).toBe(true);
});

test('a pair whose data slot is the empty terminator is trivially a binary tree node, regardless of its rest slot', () => {
  // isBinaryTreeNode's `data.type === "empty"` check returns true immediately, before even looking
  // at `rest` — so this holds even when `rest` is a bare leaf, not a proper 2-link chain. Not a
  // shape draw_data ever actually produces, but it's real, reachable behavior of the function as
  // written, and the mirror image of the general-tree case below (same shape, opposite verdict).
  const result = classify(pair(empty(), leaf(99)));
  expect(result.isBinaryTree).toBe(true);
});

test('mismatched data-type labels across sibling binary-tree nodes are rejected', () => {
  const stringLeaf: SerializedDataVisualizerNode = {
    type: 'leaf',
    displayValue: 'x',
    label: 'string',
  };
  const stringChild = pair(stringLeaf, pair(empty(), pair(empty(), empty())));
  const tree = binaryNode(2, stringChild, binaryNode(1)); // root's data is a "number" leaf
  const result = classify(tree);
  expect(result.isBinaryTree).toBe(false);
});

test('a general tree whose head element is itself an improper (non-general-tree) compound value is rejected', () => {
  const improperHead = pair(leaf(1), leaf(2)); // bare 2-tuple: not a proper list, not a general tree
  const tree = pair(improperHead, pair(leaf(3), empty()));
  const result = classify(tree);
  expect(result.isGeneralTree).toBe(false);
});
