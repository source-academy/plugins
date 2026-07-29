import { TreeNode } from "./BaseTreeNode";

/**
 * Represents a node corresponding to a leaf value (a `"leaf"` wire node) or the empty terminator (a
 * `"empty"` wire node) — anything that isn't a pair/array or a function.
 *
 * Unlike the old `DataTreeNode`, which held a raw JS value and left the renderer to figure out how to
 * stringify it (falling back to a `*N` placeholder for values it couldn't format), the runner-side
 * adapter already produced a ready-to-show `displayValue` — this node just carries it through.
 */
export class DataTreeNode extends TreeNode {
  private constructor(
    public readonly isEmpty: boolean,
    public readonly displayValue?: string,
    public readonly label?: string,
  ) {
    super();
  }

  static empty(): DataTreeNode {
    return new DataTreeNode(true);
  }

  static leaf(displayValue: string, label: string): DataTreeNode {
    return new DataTreeNode(false, displayValue, label);
  }
}
