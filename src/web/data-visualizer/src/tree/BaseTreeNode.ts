export class TreeNode {
  public children: TreeNode[] | null;
  /** This node's horizontal slot among its siblings at the same depth — populated from
   * {@link TreeLayout.posByRefId} when the tree is a valid general tree; unused otherwise. */
  public nodePos: number = 0;
  /** This node's color-palette index, shared by every box belonging to it — populated from
   * {@link TreeLayout.colorByRefId} when the tree is a valid binary or general tree; always 0
   * (rendered as plain black) in the original box-and-pointer view. */
  public nodeColor: number = 0;

  constructor() {
    this.children = null;
  }
}
