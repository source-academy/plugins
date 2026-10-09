/**
 * Lays out the e-stepper's environment diagram: where each frame, heap object and arrow goes.
 * Pure geometry, independent of Konva, so it can be tested without a canvas.
 *
 * The layout follows the CSE machine visualization's conventions:
 *  - frames are arranged in rows by nesting depth (the global frame at the top, a frame created by
 *    a call one row below the frame its function was defined in), in creation order within a row;
 *  - a function object sits to the right of the frame it was defined in, with an arrow back to it;
 *  - a list sits to the right of the first frame that refers to it (or next to the object that
 *    does), drawn as a row of boxes;
 *  - objects only the program refers to go in a row of their own at the bottom.
 */

import type {
  EStepperFrame,
  EStepperHeapObject,
  EStepperValue,
} from "@sourceacademy/common-e-stepper";

export const LayoutConfig = {
  charWidth: 7.8,
  rowHeight: 22,
  padding: 10,
  headerHeight: 20,
  frameMinWidth: 100,
  gapX: 50,
  gapY: 50,
  objectGapX: 40,
  objectGapY: 18,
  objectLabelHeight: 14,
  cellWidth: 44,
  cellHeight: 26,
  functionRadius: 11,
  dotRadius: 3.5,
  margin: 20,
} as const;

const C = LayoutConfig;

export interface Point {
  x: number;
  y: number;
}

export interface BindingRow {
  name: string;
  value: EStepperValue;
  /** Vertical centre of the row. */
  y: number;
  /** Where the value's text (or a reference's dot) starts. */
  valueX: number;
}

export interface FrameBox {
  frame: EStepperFrame;
  /** Index of the frame in the step's frame list (for its colour). */
  index: number;
  /** Top-left of the header (the label above the box). */
  x: number;
  y: number;
  /** The box itself starts `headerHeight` below `y`. */
  width: number;
  height: number;
  rows: BindingRow[];
}

export interface ObjectBox {
  object: EStepperHeapObject;
  /** Top-left of the object's drawing (its label is above it, inside `objectLabelHeight`). */
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ArrowKind = "parent" | "binding" | "environment" | "element";

export interface ArrowSpec {
  key: string;
  kind: ArrowKind;
  from: Point;
  to: Point;
  /** Whether the arrow starts at something that is garbage (drawn dimmed). */
  garbage: boolean;
}

export interface DiagramLayout {
  frames: FrameBox[];
  objects: ObjectBox[];
  arrows: ArrowSpec[];
  width: number;
  height: number;
}

export function textWidth(text: string): number {
  return text.length * C.charWidth;
}

/** The text shown for a non-reference value in a frame or list cell. */
export function valueLabel(value: EStepperValue): string {
  switch (value.kind) {
    case "primitive":
      return value.display;
    case "builtin":
      return value.name;
    case "unassigned":
      return "—";
    case "ref":
      return "";
  }
}

function valueWidth(value: EStepperValue): number {
  return value.kind === "ref" ? 3 * C.dotRadius : textWidth(valueLabel(value));
}

function objectSize(object: EStepperHeapObject): { width: number; height: number } {
  if (object.kind === "function") {
    return { width: 4 * C.functionRadius, height: 2 * C.functionRadius };
  }
  return { width: Math.max(1, object.elements.length) * C.cellWidth, height: C.cellHeight };
}

/** The point an arrow to `box` should end at: the left edge of its first box or circle. */
function arrowTarget(box: ObjectBox): Point {
  return { x: box.x, y: box.y + box.height / 2 };
}

export interface LayoutOptions {
  /**
   * Leave out what is dead: garbage frames and garbage heap objects. A live frame's ancestors are
   * live, so the frames left are still a tree.
   */
  clearDead?: boolean;
}

export function layoutDiagram(
  allFrames: EStepperFrame[],
  allHeap: EStepperHeapObject[],
  options: LayoutOptions = {},
): DiagramLayout {
  const frames = options.clearDead ? allFrames.filter(f => !f.isGarbage) : allFrames;
  const heap = options.clearDead ? allHeap.filter(o => !o.isGarbage) : allHeap;
  const frameById = new Map(frames.map(f => [f.id, f]));
  const objectById = new Map(heap.map(o => [o.id, o]));

  // Rows by nesting depth.
  const depth = new Map<string, number>();
  const depthOf = (f: EStepperFrame, seen = new Set<string>()): number => {
    const known = depth.get(f.id);
    if (known !== undefined) return known;
    const parent = f.parentId ? frameById.get(f.parentId) : undefined;
    const d = parent && !seen.has(f.id) ? depthOf(parent, seen.add(f.id)) + 1 : 0;
    depth.set(f.id, d);
    return d;
  };
  frames.forEach(f => depthOf(f));

  // Which frame's area each object goes in: a function by its defining frame; anything else by the
  // first frame (in order) that reaches it through its bindings and owned objects.
  const owner = new Map<string, string>();
  for (const o of heap) {
    if (o.kind === "function" && frameById.has(o.envId)) owner.set(o.id, o.envId);
  }
  const ownedOrder = new Map<string, string[]>(frames.map(f => [f.id, []]));
  const claim = (objectId: string, frameId: string): void => {
    const object = objectById.get(objectId);
    if (!object) return;
    const existing = owner.get(objectId);
    if (existing !== undefined && existing !== frameId) return;
    if (ownedOrder.get(frameId)!.includes(objectId)) return;
    owner.set(objectId, frameId);
    ownedOrder.get(frameId)!.push(objectId);
    if (object.kind === "list") {
      for (const e of object.elements) if (e.kind === "ref") claim(e.objectId, frameId);
    }
  };
  for (const f of frames) {
    for (const o of heap) if (o.kind === "function" && o.envId === f.id) claim(o.id, f.id);
    for (const b of f.bindings) if (b.value.kind === "ref") claim(b.value.objectId, f.id);
  }
  const unowned = heap.filter(o => !owner.has(o.id));

  const frameBoxes: FrameBox[] = [];
  const objectBoxes: ObjectBox[] = [];
  const maxDepth = Math.max(0, ...depth.values());
  let y = C.margin;
  let width = 0;
  for (let d = 0; d <= maxDepth; d++) {
    const row = frames.filter(f => depth.get(f.id) === d);
    if (row.length === 0) continue;
    let x = C.margin;
    let rowHeight = 0;
    for (const frame of row) {
      const contentWidth = Math.max(
        C.frameMinWidth - 2 * C.padding,
        ...frame.bindings.map(b => textWidth(b.name + ":") + C.padding + valueWidth(b.value)),
        textWidth(`${frame.id} ${frame.name}`) - C.padding,
      );
      const frameWidth = contentWidth + 2 * C.padding;
      const boxTop = y + C.headerHeight;
      const rows: BindingRow[] = frame.bindings.map((b, i) => ({
        name: b.name,
        value: b.value,
        y: boxTop + C.padding / 2 + i * C.rowHeight + C.rowHeight / 2,
        valueX: x + C.padding + textWidth(b.name + ":") + C.padding,
      }));
      const frameHeight = Math.max(C.rowHeight, frame.bindings.length * C.rowHeight) + C.padding;
      frameBoxes.push({
        frame,
        // The frame's colour index is its place in the step's whole frame list, dead frames
        // included, so it keeps its colour when the dead ones are left out.
        index: allFrames.indexOf(frame),
        x,
        y,
        width: frameWidth,
        height: frameHeight,
        rows,
      });

      // This frame's objects, stacked to its right.
      let objectY = y;
      let areaWidth = 0;
      for (const id of ownedOrder.get(frame.id) ?? []) {
        const object = objectById.get(id)!;
        const size = objectSize(object);
        objectBoxes.push({
          object,
          x: x + frameWidth + C.objectGapX,
          y: objectY + C.objectLabelHeight,
          ...size,
        });
        objectY += C.objectLabelHeight + size.height + C.objectGapY;
        areaWidth = Math.max(areaWidth, size.width);
      }
      const cellWidth = frameWidth + (areaWidth > 0 ? C.objectGapX + areaWidth : 0);
      rowHeight = Math.max(rowHeight, C.headerHeight + frameHeight, objectY - y);
      x += cellWidth + C.gapX;
      width = Math.max(width, x);
    }
    y += rowHeight + C.gapY;
  }

  // Objects that no frame refers to (only the program does), in a row of their own.
  if (unowned.length > 0) {
    let x = C.margin;
    let rowHeight = 0;
    for (const object of unowned) {
      const size = objectSize(object);
      objectBoxes.push({ object, x, y: y + C.objectLabelHeight, ...size });
      x += size.width + C.objectGapX;
      rowHeight = Math.max(rowHeight, C.objectLabelHeight + size.height);
      width = Math.max(width, x);
    }
    y += rowHeight + C.gapY;
  }

  // Arrows.
  const frameBoxById = new Map(frameBoxes.map(b => [b.frame.id, b]));
  const objectBoxById = new Map(objectBoxes.map(b => [b.object.id, b]));
  const arrows: ArrowSpec[] = [];
  for (const box of frameBoxes) {
    const boxTop = box.y + C.headerHeight;
    const parent = box.frame.parentId ? frameBoxById.get(box.frame.parentId) : undefined;
    if (parent) {
      arrows.push({
        key: `parent:${box.frame.id}`,
        kind: "parent",
        from: { x: box.x + box.width / 2, y: boxTop },
        to: { x: parent.x + parent.width / 2, y: parent.y + C.headerHeight + parent.height },
        garbage: box.frame.isGarbage,
      });
    }
    for (const row of box.rows) {
      if (row.value.kind !== "ref") continue;
      const target = objectBoxById.get(row.value.objectId);
      if (!target) continue;
      arrows.push({
        key: `binding:${box.frame.id}:${row.name}`,
        kind: "binding",
        from: { x: row.valueX + C.dotRadius, y: row.y },
        to: arrowTarget(target),
        garbage: box.frame.isGarbage,
      });
    }
  }
  for (const box of objectBoxes) {
    const object = box.object;
    if (object.kind === "function") {
      const env = frameBoxById.get(object.envId);
      if (!env) continue;
      arrows.push({
        key: `environment:${object.id}`,
        kind: "environment",
        from: { x: box.x + 3 * C.functionRadius, y: box.y + C.functionRadius },
        to: { x: env.x + env.width, y: env.y + C.headerHeight + C.padding },
        garbage: object.isGarbage,
      });
    } else {
      object.elements.forEach((e, i) => {
        if (e.kind !== "ref") return;
        const target = objectBoxById.get(e.objectId);
        if (!target) return;
        arrows.push({
          key: `element:${object.id}:${i}`,
          kind: "element",
          from: { x: box.x + (i + 0.5) * C.cellWidth, y: box.y + C.cellHeight / 2 },
          to: arrowTarget(target),
          garbage: object.isGarbage,
        });
      });
    }
  }

  return { frames: frameBoxes, objects: objectBoxes, arrows, width, height: y };
}
