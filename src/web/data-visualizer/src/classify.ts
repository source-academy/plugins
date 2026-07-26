import type { RefId, SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

/**
 * Cycle-detection and pair/list/tree classification for one serialized data-visualizer node tree.
 *
 * Ported from the old pre-Conductor frontend's `DataVisualizer` (`hasCycle`/`isBinaryTree`/
 * `isGeneralTree`/`initializeTreeMetaData`), generalized from a fixed 2-element-pair-only
 * representation to {@link SerializedDataVisualizerNode}'s N-ary `"array"` variant (needed because a
 * native Python list, unlike a Source/SICP pair-chain, is not fixed at length 2). This lives here,
 * once, host-side — see this package's sibling `runner-data-visualizer` package for why that logic is
 * *not* duplicated per language.
 *
 * Deliberate behavior changes from the old version (flagged, not silently replicated):
 *  - The old `hasCycle` used one `WeakSet` shared across both recursive branches with no
 *    backtrack-removal, so it flagged *any* revisited node as cyclic — including a harmless DAG where
 *    two branches merely reference the same substructure. This version distinguishes a true back-edge
 *    ({@link ClassificationResult.isCyclic}) from mere reference sharing
 *    ({@link ClassificationResult.isSharedStructure}) via a DFS-path-scoped `Set<RefId>`.
 *  - The old code classified tree-shape from only the *first* `draw_data` argument (via global
 *    static state) and reused that one classification for every argument in the call. This module is
 *    a pure function of one node, meant to be called once per argument — see the runner-data-
 *    visualizer package's per-row `RefIdAllocator` for the identity story this relies on.
 */

/** A node's "type" for homogeneity comparisons — the closest equivalent to the old code's `typeof`. */
function typeLabel(node: SerializedDataVisualizerNode): string {
  switch (node.type) {
    case "leaf":
      return node.label;
    case "array":
    case "empty":
    case "function":
    case "ref":
      return node.type;
  }
}

/** True for a node that can be a pair-chain link: an `"array"` with exactly two children. A native
 * (non-length-2) list is deliberately never tree/pair-eligible — see this file's module doc comment. */
function isPairNode(
  node: SerializedDataVisualizerNode,
): node is Extract<SerializedDataVisualizerNode, { type: "array" }> {
  return node.type === "array" && node.children.length === 2;
}

/**
 * Walks the tree once, tracking which compound (`"array"`/`"function"`) refIds are ancestors of the
 * node currently being visited. Because the runner already collapses every repeat occurrence of a
 * value into a `"ref"` node (see `RefIdAllocator`), this function never needs its own identity
 * tracking — it only needs to know, at each `"ref"` it encounters, whether that refId is *currently
 * on the path from the root* (a true cycle) or was merely visited and left earlier (harmless sharing).
 */
function detectCyclesAndSharing(root: SerializedDataVisualizerNode): {
  isCyclic: boolean;
  isSharedStructure: boolean;
} {
  const onPath = new Set<RefId>();
  let isCyclic = false;
  let isSharedStructure = false;

  function visit(node: SerializedDataVisualizerNode): void {
    switch (node.type) {
      case "ref":
        isSharedStructure = true;
        if (onPath.has(node.refId)) {
          isCyclic = true;
        }
        return;
      case "array":
        onPath.add(node.refId);
        for (const child of node.children) {
          visit(child);
        }
        onPath.delete(node.refId);
        return;
      case "function":
      case "leaf":
      case "empty":
        return;
    }
  }

  visit(root);
  return { isCyclic, isSharedStructure };
}

/**
 * A pair-chain node is a binary tree node when it has the SICP `list(data, left, right)` shape — as
 * nested pairs, `[data, [left, [right, <end>]]]` — where `left`/`right` are themselves binary trees
 * (or the empty terminator) built from same-labeled data. Only ever called on a subtree already known
 * to be acyclic and unshared (see {@link classify}), so every node reachable here is a fresh
 * `"array"`/`"empty"`/leaf/`"function"` node — never a `"ref"`.
 */
function isBinaryTreeNode(node: SerializedDataVisualizerNode, rootLabel: string | null): boolean {
  if (node.type === "empty") {
    return true;
  }
  if (!isPairNode(node)) {
    return false;
  }
  const [data, rest] = node.children;
  if (data.type === "empty") {
    return true;
  }
  if (!isPairNode(rest)) {
    return false;
  }
  if (rootLabel !== null && data.type !== "array" && typeLabel(data) !== rootLabel) {
    return false;
  }

  // `rest` should be `[left, [right, <end>]]`: walk that chain, counting links (a proper binary-tree
  // node has exactly 2 — left then right), and reject a bare same-labeled leaf at any link's head,
  // which would mean this is actually a flat list `list(a, b, c, ...)`, not `list(data, left, right)`.
  let next: SerializedDataVisualizerNode = rest;
  let count = 0;
  while (isPairNode(next)) {
    const [head] = next.children;
    if (head.type !== "array" && typeLabel(head) === typeLabel(data)) {
      return false;
    }
    count++;
    next = next.children[1];
  }
  if (count !== 2) {
    return false;
  }

  // `count` reaching 2 guarantees `rest.children[1]` is itself a pair node — that's what let the loop
  // run a second time — so this re-check only narrows the type, it can't actually fail at runtime.
  const restTail = rest.children[1];
  if (!isPairNode(restTail)) {
    return false;
  }
  // The left/right subtree slots may each be `{type:"empty"}` (no child — isBinaryTreeNode's own
  // first check accepts that as a valid, childless leaf) or a further binary-tree node; either way,
  // recursing into isBinaryTreeNode itself is the whole check — no extra shape constraint belongs here.
  const leftSubtree = rest.children[0];
  const rightSubtree = restTail.children[0];
  const label = typeLabel(data);
  return isBinaryTreeNode(leftSubtree, label) && isBinaryTreeNode(rightSubtree, label);
}

/**
 * A pair-chain node is a general tree node when it is the empty terminator, or a pair
 * `[data, tail]` where `tail` is either the empty terminator (a childless node) or itself a pair
 * `[childrenList, <end>]` whose `childrenList` is a valid {@link isSiblingChain | sibling chain}.
 *
 * This is a clean structural re-derivation of the old `isGeneralTree`, not a line-for-line port: the
 * original overloaded a single function for two different roles — "is this one tree node" vs. "is
 * this a list of sibling nodes" — distinguished only by which recursive branch called it, and leaned
 * on several JavaScript loose-equality/out-of-bounds-indexing quirks (e.g. `undefined != null` being
 * `false`) that have no clean equivalent on a typed node representation. Splitting the two roles into
 * mutually-recursive functions is both easier to verify and behaviourally clearer. Unlike
 * {@link isBinaryTreeNode}, this does not enforce data-label homogeneity across siblings — flagged as
 * a deliberate simplification: a general tree's data payloads are not required to share one type.
 */
function isGeneralTreeNode(node: SerializedDataVisualizerNode): boolean {
  if (node.type === "empty") {
    return true;
  }
  if (!isPairNode(node)) {
    return false;
  }
  const [, tail] = node.children;
  if (tail.type === "empty") {
    return true;
  }
  if (!isPairNode(tail) || tail.children[1].type !== "empty") {
    return false;
  }
  return isSiblingChain(tail.children[0]);
}

/** A list of general-tree siblings: the empty terminator, or `[firstChild, restOfChain]` where
 * `firstChild` is itself a valid {@link isGeneralTreeNode | general tree node} and `restOfChain` is
 * a valid sibling chain. */
function isSiblingChain(node: SerializedDataVisualizerNode): boolean {
  if (node.type === "empty") {
    return true;
  }
  if (!isPairNode(node)) {
    return false;
  }
  const [firstChild, restOfChain] = node.children;
  return isGeneralTreeNode(firstChild) && isSiblingChain(restOfChain);
}

/** Depth/position/color layout bookkeeping for rendering a classified tree, keyed by {@link RefId}
 * instead of the old code's live-object-identity `WeakMap`s. Mirrors `initializeTreeMetaData`, minus
 * the old code's view-mode gating (`treeMode`/`binTreeMode` toggles) — computing this is cheap, so it
 * is always populated when the node is a binary or general tree, and it is up to the renderer (not
 * this module) to decide which parts a given view mode actually uses. */
export interface TreeLayout {
  treeDepth: number;
  longestNodePos: number;
  colorByRefId: Map<RefId, number>;
  posByRefId: Map<RefId, number>;
}

function computeLayout(root: SerializedDataVisualizerNode): TreeLayout {
  const colorByRefId = new Map<RefId, number>();
  const posByRefId = new Map<RefId, number>();
  const nodeCountByDepth: number[] = [];
  const nodeColorByDepth: number[] = [];
  let treeDepth = 0;
  let longestNodePos = 0;

  function visit(node: SerializedDataVisualizerNode, depth: number, isNewNode: boolean): void {
    if (!isPairNode(node)) {
      return;
    }
    if (nodeCountByDepth[depth] === undefined) {
      nodeCountByDepth[depth] = 0;
    }
    posByRefId.set(node.refId, nodeCountByDepth[depth]);
    if (nodeCountByDepth[depth] > longestNodePos) {
      longestNodePos = nodeCountByDepth[depth];
    }
    nodeCountByDepth[depth]++;

    if (nodeColorByDepth[depth] === undefined) {
      nodeColorByDepth[depth] = depth;
    }
    if (isNewNode) {
      nodeColorByDepth[depth]++;
    }
    colorByRefId.set(node.refId, nodeColorByDepth[depth]);

    treeDepth = Math.max(treeDepth, depth);
    visit(node.children[0], depth + 1, true);
    visit(node.children[1], depth, false);
  }

  visit(root, 0, false);
  return { treeDepth, longestNodePos, colorByRefId, posByRefId };
}

export interface ClassificationResult {
  /** True if the tree contains a genuine back-edge (a value that is its own ancestor). */
  isCyclic: boolean;
  /** True if any value is referenced more than once, whether or not that sharing forms a cycle. */
  isSharedStructure: boolean;
  isBinaryTree: boolean;
  isGeneralTree: boolean;
  /** Present only when {@link isBinaryTree} or {@link isGeneralTree} is true. */
  layout?: TreeLayout;
}

/**
 * Classifies one serialized node (one element of one {@link SerializedDataVisualizerRow}). Call this
 * once per node — classification never depends on anything outside the node itself.
 */
export function classify(node: SerializedDataVisualizerNode): ClassificationResult {
  const { isCyclic, isSharedStructure } = detectCyclesAndSharing(node);
  // A tree (in the SICP teaching sense) has no shared or cyclic substructure by definition — that
  // would make it a DAG or a graph, not a tree — so skip classification entirely rather than walk a
  // shape isBinaryTreeNode/isGeneralTreeNode were never designed to see a "ref" node.
  if (isCyclic || isSharedStructure) {
    return { isCyclic, isSharedStructure, isBinaryTree: false, isGeneralTree: false };
  }

  const isBinTree = isBinaryTreeNode(node, null);
  const isGenTree = isGeneralTreeNode(node);
  return {
    isCyclic,
    isSharedStructure,
    isBinaryTree: isBinTree,
    isGeneralTree: isGenTree,
    layout: isBinTree || isGenTree ? computeLayout(node) : undefined,
  };
}
