import type {
  EStepperFrame,
  EStepperHeapObject,
  EStepperStep,
} from "@sourceacademy/common-e-stepper";
import { describe, expect, test } from "vitest";

import { frameColor } from "../colors";
import { layoutDiagram, LayoutConfig as C, type DiagramLayout } from "../layout";
import steps from "./makeWithdrawSteps.json";

/** The last step of `make_withdraw` (produced by py-slang's e-stepper engine): frames Global, E1,
 * E2 (garbage), function objects #1 (in Global) and #2 (in E1), lists #4 = [W1, #3] and #3. */
const last = (steps as unknown as EStepperStep[])[2];

type Rect = { x: number; y: number; width: number; height: number; what: string };

function rects(layout: DiagramLayout): Rect[] {
  return [
    ...layout.frames.map(f => ({
      x: f.x,
      y: f.y,
      width: f.width,
      height: C.headerHeight + f.height,
      what: f.frame.id,
    })),
    ...layout.objects.map(o => ({
      x: o.x,
      y: o.y - C.objectLabelHeight,
      width: o.width,
      height: C.objectLabelHeight + o.height,
      what: o.object.id,
    })),
  ];
}

const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("layoutDiagram on make_withdraw", () => {
  const layout = layoutDiagram(last.frames, last.heap);
  const frame = (id: string) => layout.frames.find(f => f.frame.id === id)!;
  const object = (id: string) => layout.objects.find(o => o.object.id === id)!;

  test("frames are in rows by nesting depth", () => {
    expect(layout.frames.map(f => f.frame.id)).toEqual(["Global", "E1", "E2"]);
    expect(frame("Global").y).toBeLessThan(frame("E1").y);
    expect(frame("E1").y).toBeLessThan(frame("E2").y);
  });

  test("function objects sit to the right of the frame they were defined in", () => {
    for (const [fn, env] of [
      ["#1", "Global"],
      ["#2", "E1"],
    ]) {
      expect(object(fn).x).toBeGreaterThan(frame(env).x + frame(env).width);
      expect(object(fn).y).toBeGreaterThanOrEqual(frame(env).y);
      expect(object(fn).y).toBeLessThan(frame(env).y + C.headerHeight + frame(env).height + 60);
    }
  });

  test("lists sit with the first frame that refers to them, nested lists alongside", () => {
    const global = frame("Global");
    for (const id of ["#4", "#3"]) {
      expect(object(id).x).toBeGreaterThan(global.x + global.width);
      expect(object(id).y).toBeLessThan(frame("E1").y);
    }
    expect(object("#4").width).toBe(2 * C.cellWidth);
  });

  test("nothing overlaps, and everything is inside the drawing", () => {
    const all = rects(layout);
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        expect(overlaps(all[i], all[j]), `${all[i].what} overlaps ${all[j].what}`).toBe(false);
      }
      expect(all[i].x + all[i].width).toBeLessThanOrEqual(layout.width);
      expect(all[i].y + all[i].height).toBeLessThanOrEqual(layout.height);
    }
  });

  test("arrows: one per reference binding, list element, function environment and parent", () => {
    const keys = layout.arrows.map(a => a.key).sort();
    expect(keys).toEqual(
      [
        "binding:Global:make_withdraw",
        "binding:Global:W1",
        "binding:Global:xs",
        "binding:E1:withdraw",
        "element:#4:0",
        "element:#4:1",
        "environment:#1",
        "environment:#2",
        "parent:E1",
        "parent:E2",
      ].sort(),
    );
    // A binding arrow ends at the left edge of its object.
    const w1 = layout.arrows.find(a => a.key === "binding:Global:W1")!;
    expect(w1.to.x).toBe(object("#2").x);
    // An arrow from a garbage frame is dimmed.
    expect(layout.arrows.find(a => a.key === "parent:E2")!.garbage).toBe(true);
  });
});

describe("layoutDiagram edge cases", () => {
  test("objects no frame refers to go in a row of their own at the bottom", () => {
    const frames: EStepperFrame[] = [
      { id: "Global", name: "global", parentId: null, bindings: [], isGarbage: false },
    ];
    const heap: EStepperHeapObject[] = [{ kind: "list", id: "#1", elements: [], isGarbage: false }];
    const layout = layoutDiagram(frames, heap);
    expect(layout.objects[0].y).toBeGreaterThan(layout.frames[0].y + C.headerHeight);
    expect(layout.objects[0].width).toBe(C.cellWidth);
  });

  test("an empty store lays out to an empty drawing", () => {
    const layout = layoutDiagram([], []);
    expect(layout.frames).toEqual([]);
    expect(layout.arrows).toEqual([]);
  });
});

test("the global frame is neutral, other frames get distinct colours", () => {
  const colors = [0, 1, 2, 3].map(frameColor);
  expect(new Set(colors).size).toBe(4);
});

describe("layoutDiagram with dead frames collapsed", () => {
  const full = layoutDiagram(last.frames, last.heap);
  const collapsed = layoutDiagram(last.frames, last.heap, { collapseDead: true });

  test("a garbage frame keeps its label but loses its bindings", () => {
    const dead = last.frames.filter(f => f.isGarbage);
    expect(dead.length).toBeGreaterThan(0);
    for (const f of dead) {
      const box = collapsed.frames.find(b => b.frame.id === f.id)!;
      expect(box.collapsed).toBe(true);
      expect(box.rows).toEqual([]);
      expect(box.height).toBeLessThanOrEqual(full.frames.find(b => b.frame.id === f.id)!.height);
    }
  });

  test("live frames are untouched, and garbage objects are left out", () => {
    for (const b of collapsed.frames.filter(b => !b.frame.isGarbage)) {
      expect(b.collapsed).toBe(false);
      expect(b.rows.length).toBe(full.frames.find(f => f.frame.id === b.frame.id)!.rows.length);
    }
    const garbage = last.heap.filter(o => o.isGarbage).map(o => o.id);
    expect(collapsed.objects.map(o => o.object.id)).toEqual(
      full.objects.map(o => o.object.id).filter(id => !garbage.includes(id)),
    );
  });

  test("nothing changes when nothing is dead", () => {
    const live = last.frames.map(f => ({ ...f, isGarbage: false }));
    const heap = last.heap.map(o => ({ ...o, isGarbage: false }));
    expect(layoutDiagram(live, heap, { collapseDead: true })).toEqual(layoutDiagram(live, heap));
  });
});
