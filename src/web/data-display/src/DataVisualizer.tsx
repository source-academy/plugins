import type { ArrayValue, Data } from "@sourceacademy/common-data-display";
import { Config } from "./utils/Config";
import { type Step, DataVizMode } from "./DataVisualizerTypes";
import { Tree } from "./tree/Tree";
import { DataTreeNode } from "./tree/TreeNode";
import { is_list, length_list, reduce_list } from "./utils/list";

/**
 * The data visualizer class.
 * Exposes three function: init, drawData, and clear.
 *
 * init is used by SideContentDataVisualizer as a hook.
 * drawData is the draw_data function in source.
 * clear is used by WorkspaceSaga to reset the visualizer after every "Run" button press
 */
export default class DataVisualizer {
  private static empty() {}
  private static setSteps: (step: Step[]) => void = DataVisualizer.empty;
  public static dataRecords: Data[][] = [];
  public static isRedraw = false;
  private static _instance = new DataVisualizer();
  public static mode: DataVizMode = DataVizMode.NORMAL;
  public static TreeDepth = 0;
  public static isBinTree = false;
  public static isGenTree = false;
  public static nodeCount: number[] = [];
  public static nodeColor: number[] = [];
  public static longestNodePos: number = 0;
  public static colorMap: WeakMap<ArrayValue, number> = new WeakMap();
  public static posMap: WeakMap<ArrayValue, number> = new WeakMap();

  private steps: Step[] = [];
  private nodeLabel = 0;
  private nodeToLabelMap: Map<DataTreeNode, number> = new Map();

  private constructor() {}

  public static isBinaryTree(structures: Data, type: string | null = null): boolean {
    if (structures.type === "null") {
      return true;
    }
    if (!is_list(structures) || length_list(structures) !== 3) {
      return false;
    }

    if (type === null) {
      type = structures.value[0].type;
    }
    if (structures.value[0].type !== type) {
      return false;
    }

    return reduce_list((acc, x) => acc && this.isBinaryTree(x, type), true, structures.value[1]);
  }

  public static isGeneralTree(structures: Data): boolean {
    if (structures.type === "null") {
      return true;
    }
    if (!is_list(structures)) {
      return false;
    }
    return reduce_list(
      (acc, x) => acc && (!is_list(x) || this.isGeneralTree(x)),
      true,
      structures.value[1],
    );
  }

  public static initializeTreeMetaData(
    structures: Data,
    depth: number,
    nodePos: number,
    newNode: boolean,
  ): number {
    if (structures.type !== "array") {
      return 0;
    }
    // nodeCount keeps track of the current index of nodes at each depth
    if (this.getMode() === DataVizMode.GENERAL_TREE) {
      if (this.nodeCount[depth] === undefined) {
        this.nodeCount[depth] = 0;
      }
      this.posMap.set(structures, this.nodeCount[depth]);
      if (this.nodeCount[depth] > this.longestNodePos) {
        this.longestNodePos = this.nodeCount[depth];
      }
      this.nodeCount[depth]++;
    }
    if (this.getMode() === DataVizMode.BINARY_TREE || this.getMode() === DataVizMode.GENERAL_TREE) {
      if (this.nodeColor[depth] === undefined) {
        this.nodeColor[depth] = depth;
      }
      if (newNode) {
        this.nodeColor[depth]++;
      }
      this.colorMap.set(structures, this.nodeColor[depth]);
    }

    this.TreeDepth = Math.max(this.TreeDepth, depth);
    this.initializeTreeMetaData(structures.value[0], depth + 1, 0, true);
    this.initializeTreeMetaData(structures.value[1], depth, nodePos + 1, false);
    return depth;
  }

  public static init(setSteps: (step: Step[]) => void): void {
    DataVisualizer.setSteps = setSteps;
    setSteps(DataVisualizer._instance.steps);
  }

  /**
   * Set the visualization mode. This ensures only one mode is active at a time.
   * @param mode - 'normal' for original view, 'binTree' for binary tree, 'tree' for general tree
   */
  public static setMode(mode: DataVizMode): void {
    DataVisualizer.mode = mode;
  }

  public static getMode(): DataVizMode {
    return DataVisualizer.mode;
  }

  public static hasCycle(structures: Data, visited: WeakSet<ArrayValue> = new WeakSet()): boolean {
    if (structures.type !== "array") {
      return false;
    }
    if (visited.has(structures)) {
      return true;
    }
    visited.add(structures);
    return structures.value.some(x => this.hasCycle(x, visited));
  }

  public static drawData(structures: Data[]): void {
    if (!DataVisualizer.setSteps) {
      throw new Error("Data visualizer not initialized");
    }
    if (!DataVisualizer.isRedraw) {
      this.dataRecords.push(structures);
    }
    const root = structures[0];
    const isCyclic = this.hasCycle(root);
    DataVisualizer.nodeCount = [];
    DataVisualizer.nodeColor = [];
    this.nodeColor[0] = -1;
    DataVisualizer.longestNodePos = 0;
    DataVisualizer.TreeDepth = 0;
    if (isCyclic) {
      DataVisualizer.isBinTree = false;
      DataVisualizer.isGenTree = false;
    } else {
      DataVisualizer.isBinTree = this.isBinaryTree(root);
      DataVisualizer.isGenTree = this.isGeneralTree(root);
      if (DataVisualizer.isBinTree || DataVisualizer.isGenTree) {
        this.initializeTreeMetaData(root, 0, 0, false);
      }
    }
    DataVisualizer._instance.addStep(structures);

    DataVisualizer.setSteps(DataVisualizer._instance.steps);
  }

  public static clearWithData(): void {
    DataVisualizer.longestNodePos = 0;
    DataVisualizer.dataRecords = [];
    DataVisualizer.isRedraw = false;
    DataVisualizer.clear();
  }

  public static clear(): void {
    DataVisualizer._instance = new DataVisualizer();
    this.nodeCount = [];
    this.TreeDepth = 0;
    DataVisualizer.setSteps(DataVisualizer._instance.steps);
  }

  public static displaySpecialContent(dataNode: DataTreeNode): number {
    return DataVisualizer._instance.displaySpecialContent(dataNode);
  }

  private displaySpecialContent(dataNode: DataTreeNode): number {
    if (this.nodeToLabelMap.has(dataNode)) {
      return this.nodeToLabelMap.get(dataNode) ?? 0;
    } else {
      this.nodeToLabelMap.set(dataNode, this.nodeLabel);
      return this.nodeLabel++;
    }
  }

  private addStep(structures: Data[]) {
    const step = structures.map((xs, index) => this.createDrawing(xs, index));
    this.steps.push(step);
  }

  private createDrawing(xs: Data, key: number): React.ReactElement {
    const treeDrawer = Tree.fromSourceStructure(xs).draw();

    // To account for overflow to the left side due to a backward arrow
    const leftMargin = Config.StrokeWidth / 2;

    // To account for overflow to the top due to a backward arrow
    const topMargin = Config.StrokeWidth / 2;

    return treeDrawer.draw(leftMargin, topMargin, key);
  }

  static redraw() {
    this.isRedraw = true;
    this.clear();
    try {
      DataVisualizer.dataRecords.forEach(this.drawData);
    } finally {
      this.isRedraw = false;
    }
  }
}
