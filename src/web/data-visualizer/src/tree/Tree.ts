import type { RefId, SerializedDataVisualizerNode } from '@sourceacademy/common-data-visualizer';

import { AlreadyParsedTreeNode } from './AlreadyParsedTreeNode';
import { OriginalDrawer } from './OriginalDrawer';
import { ArrayTreeNode, DataTreeNode, DrawableTreeNode, FunctionTreeNode, TreeNode } from './TreeNode';

/**
 *  A tree object built from one serialized data-visualizer node (one drawn argument of one
 *  `draw_data(...)` call).
 */
export class Tree {
  private _rootNode: TreeNode;
  private nodes: DrawableTreeNode[];

  /**
   * Constructs a tree given a root node and a list of nodes.
   * @param rootNode The root node of the tree.
   * @param nodes The memoized nodes of the tree in list form.
   */
  constructor(rootNode: TreeNode, nodes: DrawableTreeNode[]) {
    this._rootNode = rootNode;
    this.nodes = nodes;
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
    let nodeCount = 0;
    const treeNodes: DrawableTreeNode[] = [];
    // Detects cycles and shared structure — a "ref" wire node re-uses whatever tree node was
    // already built for that refId, rather than being walked again. Populated before recursing into
    // an array/function's own children, so a genuine self-reference resolves correctly too.
    const refToTreeNode = new Map<RefId, DrawableTreeNode>();

    function constructNode(node: SerializedDataVisualizerNode): TreeNode {
      switch (node.type) {
        case 'ref': {
          const already = refToTreeNode.get(node.refId);
          // Should always be present — the runner never emits a "ref" before the value it refers
          // to. Falling back to empty rather than throwing keeps a malformed message from crashing
          // the whole tab.
          return already ? new AlreadyParsedTreeNode(already) : DataTreeNode.empty();
        }
        case 'empty':
          return DataTreeNode.empty();
        case 'leaf':
          return DataTreeNode.leaf(node.displayValue, node.label);
        case 'array': {
          const treeNode = new ArrayTreeNode();
          refToTreeNode.set(node.refId, treeNode);
          treeNodes[nodeCount] = treeNode;
          nodeCount++;
          treeNode.children = node.children.map(constructNode);
          return treeNode;
        }
        case 'function': {
          const treeNode = new FunctionTreeNode();
          refToTreeNode.set(node.refId, treeNode);
          treeNodes[nodeCount] = treeNode;
          nodeCount++;
          return treeNode;
        }
      }
    }

    const rootNode = constructNode(node);
    return new Tree(rootNode, treeNodes);
  }

  draw(x: number, y: number, key: number): React.ReactElement {
    return new OriginalDrawer(this).draw(x, y, key);
  }
}
