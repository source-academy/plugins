import { act } from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

import ProgramArrows, {
  arrowGeometry,
  computeProgramArrows,
  ENV_ATTRIBUTE,
  REF_ATTRIBUTE,
} from "../ProgramArrows";

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;

/** A fake element whose box is `box`, with the marks of `marks` inside it. */
function fake(box: DOMRect, attributes: Record<string, string> = {}, marks: unknown[] = []) {
  return {
    getBoundingClientRect: () => box,
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelectorAll: (selector: string) => {
      const attribute = selector.slice(1, -1);
      return marks.filter(m => (m as Element).getAttribute(attribute) !== null);
    },
  } as unknown as Element;
}

describe("arrowGeometry", () => {
  test("leaves and arrives horizontally when the target is further across than down", () => {
    const { path, head } = arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(path).toBe("M 0 0 C 50 0, 50 20, 100 20");
    expect(head.startsWith("100 20 ")).toBe(true);
  });

  test("goes vertically when the panes are stacked", () => {
    const { path } = arrowGeometry({ x: 10, y: 0 }, { x: 0, y: 200 });
    expect(path).toBe("M 10 0 C 10 100, 0 100, 0 200");
  });

  test("comes down onto the top of an object, whatever the layout", () => {
    // Side by side (further across than down): it still arrives vertically, from above.
    const { path } = arrowGeometry({ x: 0, y: 0 }, { x: 200, y: 40 }, "above");
    expect(path).toBe("M 0 0 C 100 0, 200 20, 200 40");
  });

  test("arrives at a frame from the left, whatever the layout", () => {
    // Side by side: a horizontal arrival, as before.
    expect(arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 20 }, "left").path).toBe(
      "M 0 0 C 50 0, 50 20, 100 20",
    );
    // Stacked: it leaves downwards, but still comes into the left edge, pointing right.
    const stacked = arrowGeometry({ x: 10, y: 0 }, { x: 80, y: 300 }, "left");
    expect(stacked.path).toBe("M 10 0 C 10 120, 45 300, 80 300");
    expect(stacked.head.startsWith("80 300 ")).toBe(true);
  });

  test("a frame to the left of the start is still entered from its left", () => {
    expect(arrowGeometry({ x: 100, y: 0 }, { x: 0, y: 200 }, "left").path).toBe(
      "M 100 0 C 100 100, -40 200, 0 200",
    );
  });

  test("bends back correctly when the target is to the left", () => {
    expect(arrowGeometry({ x: 100, y: 0 }, { x: 0, y: 0 }).path).toBe("M 100 0 C 50 0, 50 0, 0 0");
  });
});

describe("computeProgramArrows", () => {
  const container = fake(rect(100, 50, 800, 400));
  const program = (marks: unknown[]) => fake(rect(100, 50, 300, 400), {}, marks);
  const diagram = fake(rect(500, 50, 400, 400));
  const resolve = ({ kind, id }: { kind: string; id: string }) =>
    id === "missing" ? null : kind === "object" ? { x: 10, y: 20 } : { x: 30, y: 40 };

  test("draws an arrow from each badge and bracket label to its target, in container coordinates", () => {
    const ref = fake(rect(150, 100, 20, 10), { [REF_ATTRIBUTE]: "#1" });
    const env = fake(rect(120, 200, 20, 12), { [ENV_ATTRIBUTE]: "E1" });
    const arrows = computeProgramArrows(container, program([ref, env]), diagram, resolve);
    expect(arrows.map(a => [a.kind, a.id, a.from, a.to])).toEqual([
      ["object", "#1", { x: 60, y: 55 }, { x: 410, y: 20 }],
      ["frame", "E1", { x: 30, y: 156 }, { x: 430, y: 40 }],
    ]);
  });

  test("skips marks scrolled out of the program pane, and targets that are not drawn or not in view", () => {
    const scrolledOut = fake(rect(150, 600, 20, 10), { [REF_ATTRIBUTE]: "#1" });
    const notDrawn = fake(rect(150, 100, 20, 10), { [REF_ATTRIBUTE]: "missing" });
    const outOfView = fake(rect(150, 100, 20, 10), { [REF_ATTRIBUTE]: "#3" });
    const far = ({ id }: { id: string }) =>
      id === "#3" ? { x: 900, y: 20 } : id === "missing" ? null : { x: 1, y: 1 };
    expect(
      computeProgramArrows(container, program([scrolledOut, notDrawn, outOfView]), diagram, far),
    ).toHaveLength(0);
  });
});

describe("ProgramArrows", () => {
  const ref = fake(rect(150, 100, 20, 10), { [REF_ATTRIBUTE]: "#1" });
  const env = fake(rect(120, 200, 20, 12), { [ENV_ATTRIBUTE]: "E1" });
  const listeners = new Map<string, () => void>();
  const programEl = Object.assign(fake(rect(100, 50, 300, 400), {}, [ref, env]), {
    addEventListener: (type: string, fn: () => void) => listeners.set(type, fn),
    removeEventListener: (type: string) => listeners.delete(type),
  });
  const diagramEl = fake(rect(500, 50, 400, 400));
  const containerEl = {
    getBoundingClientRect: () => rect(100, 50, 800, 400),
    querySelector: (selector: string) =>
      selector === ".estepper-program"
        ? programEl
        : selector === ".estepper-diagram"
          ? diagramEl
          : null,
  };

  function mount(props: Partial<Parameters<typeof ProgramArrows>[0]> = {}) {
    vi.stubGlobal("window", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(
        <ProgramArrows
          resolve={({ kind }) => (kind === "object" ? { x: 10, y: 20 } : { x: 30, y: 40 })}
          hovered={null}
          hoveredFrame={null}
          colorOfFrame={() => "#ff0000"}
          {...props}
        />,
        { createNodeMock: () => ({ parentElement: containerEl }) },
      );
    });
    return renderer;
  }
  const strokes = (r: TestRenderer.ReactTestRenderer) =>
    r.root
      .findAllByType("path")
      .map(p => [p.props.stroke, p.props.strokeWidth, p.parent!.props.opacity]);

  test("draws an arrow for each mark: grey for objects, in the frame's colour for frames", () => {
    const view = mount();
    expect(view.root.findAllByType("polygon")).toHaveLength(2);
    expect(strokes(view)).toEqual([
      ["#c5cbd3", 1.5, 0.55],
      ["#ff0000", 1.5, 0.55],
    ]);
    act(() => view.unmount());
    vi.unstubAllGlobals();
  });

  test("emphasizes the arrows of the hovered object or frame", () => {
    const object = mount({ hovered: "#1" });
    expect(strokes(object)[0]).toEqual(["#c5cbd3", 2.5, 1]);
    expect(strokes(object)[1][1]).toBe(1.5);
    const frame = mount({ hoveredFrame: "E1" });
    expect(strokes(frame)[1]).toEqual(["#ff0000", 2.5, 1]);
    vi.unstubAllGlobals();
  });

  test("draws none without anchors, and measures again when the program pane scrolls", () => {
    expect(strokes(mount({ resolve: null }))).toEqual([]);
    const view = mount();
    expect(listeners.has("scroll")).toBe(true);
    act(() => listeners.get("scroll")!());
    expect(view.root.findAllByType("path")).toHaveLength(2);
    act(() => view.unmount());
    expect(listeners.has("scroll")).toBe(false);
    vi.unstubAllGlobals();
  });
});
