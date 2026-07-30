import type { RefId, SerializedDataVisualizerNode } from "@sourceacademy/common-data-visualizer";

import { classify, type ClassificationResult } from "../classify";
import { AlreadyParsedTreeNode } from "./AlreadyParsedTreeNode";
import { BinaryTreeDrawer } from "./BinaryTreeDrawer";
import { ClassicDrawer } from "./ClassicDrawer";
import { GeneralTreeDrawer } from "./GeneralTreeDrawer";
import {
  ArrayTreeNode,
  DataTreeNode,
  DrawableTreeNode,
  FunctionTreeNode,
  TreeNode,
} from "./TreeNode";

export type ViewMode = "classic" | "binaryTree" | "generalTree";

/**
 *  A tree object built from one serialized data-visualizer node (one drawn argument of one
 *  `draw_data(...)` call).
 */
export class Tree {
  private _rootNode: TreeNode;
  private nodes: DrawableTreeNode[];
  private classification: ClassificationResult;

  /**
   * Constructs a tree given a root node, a list of nodes, and the node's classification.
   * @param rootNode The root node of the tree.
   * @param nodes The memoized nodes of the tree in list form.
   * @param classification The root node's classification (cycles, sharing, tree shape).
   */
  constructor(rootNode: TreeNode, nodes: DrawableTreeNode[], classification: ClassificationResult) {
    this._rootNode = rootNode;
    this.nodes = nodes;
    this.classification = classification;
  }

  /**
   * The root node of the tree.
   */
  get rootNode(): TreeNode {
    return this._rootNode;
  }

  /**
   * Returns the memoized node of the given id.
   * @param id The id of the node.
   */
  getNodeById(id: number): DrawableTreeNode {
    return this.nodes[id];
  }

  static fromSerializedNode(node: SerializedDataVisualizerNode): Tree {
    const classification = classify(node);
    const layout = classification.layout;

    let nodeCount = 0;
    const treeNodes: DrawableTreeNode[] = [];
    // Detects cycles and shared structure — a "ref" wire node re-uses whatever tree node was
    // already built for that refId, rather than being walked again. Populated before recursing into
    // an array/function's own children, so a genuine self-reference resolves correctly too.
    const refToTreeNode = new Map<RefId, DrawableTreeNode>();

    function constructNode(node: SerializedDataVisualizerNode): TreeNode {
      switch (node.type) {
        case "ref": {
          const already = refToTreeNode.get(node.refId);
          // Should always be present — the runner never emits a "ref" before the value it refers
          // to. Falling back to empty rather than throwing keeps a malformed message from crashing
          // the whole tab.
          return already ? new AlreadyParsedTreeNode(already) : DataTreeNode.empty();
        }
        case "empty":
          return DataTreeNode.empty();
        case "leaf":
          return DataTreeNode.leaf(node.displayValue, node.label);
        case "array": {
          const treeNode = new ArrayTreeNode();
          refToTreeNode.set(node.refId, treeNode);
          treeNodes[nodeCount] = treeNode;
          nodeCount++;

          treeNode.nodeColor = layout?.colorByRefId.get(node.refId) ?? 0;
          treeNode.nodePos = layout?.posByRefId.get(node.refId) ?? 0;

          treeNode.children = node.children.map(constructNode);
          return treeNode;
        }
        case "function": {
          const treeNode = new FunctionTreeNode();
          refToTreeNode.set(node.refId, treeNode);
          treeNodes[nodeCount] = treeNode;
          nodeCount++;
          return treeNode;
        }
      }
    }

    const rootNode = constructNode(node);
    return new Tree(rootNode, treeNodes, classification);
  }

  /**
   * Picks the drawer for a given view mode. `binaryTree`/`generalTree` still return a drawer even
   * when this tree isn't actually that shape — the drawer itself renders a "not a binary/general
   * tree" warning box in that case (see {@link BinaryTreeDrawer}/{@link GeneralTreeDrawer}), rather
   * than this method silently falling back to the classic view underneath the selected toggle.
   */
  draw(viewMode: ViewMode): ClassicDrawer | BinaryTreeDrawer | GeneralTreeDrawer {
    switch (viewMode) {
      case "binaryTree":
        return new BinaryTreeDrawer(this, this.classification);
      case "generalTree":
        return new GeneralTreeDrawer(this, this.classification);
      default:
        return new ClassicDrawer(this);
    }
  }
}
