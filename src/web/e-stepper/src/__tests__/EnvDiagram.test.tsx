import type { EStepperStep } from "@sourceacademy/common-e-stepper";
import { act, createElement } from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

// Konva's Node build needs the optional `canvas` package, so the shapes are stubbed — as plain
// host elements (`konva-rect`, ...) that keep their props and render their children, so the
// drawing code runs and what it draws can be inspected.
vi.mock("konva", () => ({ default: {} }));
vi.mock("react-konva", () => {
  const stub = (name: string) => (props: Record<string, unknown>) =>
    createElement(`konva-${name.toLowerCase()}`, props, props.children as never);
  return Object.fromEntries(
    ["Stage", "Layer", "Text", "Group", "Line", "Rect", "Circle", "Arrow"].map(n => [n, stub(n)]),
  );
});

import { DiagramColors } from "../colors";
import EnvDiagram from "../EnvDiagram";
import { layoutDiagram } from "../layout";
import steps from "./makeWithdrawSteps.json";

/** A stubbed Konva shape's host element type (see the react-konva mock above). */
const konva = (type: string) => type as unknown as React.ElementType;

/** make_withdraw, inside the call of withdraw (E2 active; see makeWithdrawSteps.json). */
const step = (steps as unknown as EStepperStep[])[1];

function draw(overrides: Partial<Parameters<typeof EnvDiagram>[0]> = {}) {
  const onHover = vi.fn();
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(
      <EnvDiagram
        frames={step.frames}
        heap={step.heap}
        activeFrameId={step.activeFrameId}
        lookups={[]}
        hovered={null}
        onHover={onHover}
        width={800}
        height={600}
        {...overrides}
      />,
    );
  });
  return { root: renderer.root, onHover };
}

const texts = (root: TestRenderer.ReactTestInstance) =>
  root.findAllByType(konva("konva-text")).map(t => String(t.props.text));

describe("EnvDiagram", () => {
  test("draws every frame with its label and bindings", () => {
    const all = texts(draw().root);
    expect(all).toEqual(expect.arrayContaining(["Global", "E1  make_withdraw", "E2  withdraw"]));
    expect(all).toEqual(expect.arrayContaining(["balance:", "50", "amount:"]));
  });

  test("outlines the active frame", () => {
    const frameRects = draw()
      .root.findAllByType(konva("konva-rect"))
      .filter(r => r.props.cornerRadius === 6);
    const widths = frameRects.map(r => r.props.strokeWidth);
    expect(widths.filter(w => w === 4)).toHaveLength(1);
  });

  test("draws function objects as two circles and lists as boxes with their elements", () => {
    const { root } = draw();
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(["#1 make_withdraw", "#2 withdraw", "#4", "#3"]));
    expect(all).toEqual(expect.arrayContaining(["1", "2"]));
    expect(root.findAllByType(konva("konva-arrow")).length).toBeGreaterThan(5);
  });

  test("highlights the bindings a step reads", () => {
    const { root } = draw({ lookups: [{ frameId: "E1", name: "balance" }] });
    const highlights = root
      .findAllByType(konva("konva-rect"))
      .filter(r => r.props.fill === DiagramColors.lookup);
    expect(highlights).toHaveLength(1);
  });

  test("dims garbage and reports hovering over an object", () => {
    const last = (steps as unknown as EStepperStep[])[2];
    const { root, onHover } = draw({
      frames: last.frames,
      heap: last.heap,
      activeFrameId: "Global",
    });
    const dimmed = root
      .findAllByType(konva("konva-group"))
      .filter(g => g.props.opacity === DiagramColors.garbageOpacity);
    expect(dimmed.length).toBeGreaterThan(0);
    // Frames report hovering through onHoverFrame (not given here), objects through onHover.
    const object = root
      .findAllByType(konva("konva-group"))
      .filter(g => typeof g.props.onMouseEnter === "function")
      .find(g => {
        act(() => g.props.onMouseEnter());
        return onHover.mock.calls.length > 0;
      })!;
    expect(onHover).toHaveBeenLastCalledWith(expect.stringMatching(/^#\d+$/));
    act(() => object.props.onMouseLeave());
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  test("draws dead frames, their data and their arrows grey, and live ones in their colours", () => {
    const last = (steps as unknown as EStepperStep[])[2];
    const { root } = draw({ frames: last.frames, heap: last.heap, activeFrameId: "Global" });
    const outlines = root
      .findAllByType(konva("konva-rect"))
      .filter(r => r.props.cornerRadius === 6)
      .map(r => r.props.stroke);
    expect(outlines.filter(c => c === DiagramColors.garbage)).toHaveLength(
      last.frames.filter(f => f.isGarbage).length,
    );
    expect(new Set(outlines).size).toBeGreaterThan(1);
    const arrows = root.findAllByType(konva("konva-arrow")).map(a => a.props.stroke);
    expect(arrows).toContain(DiagramColors.garbage);
    expect(arrows).toContain(DiagramColors.stroke);
  });

  test("draws the values in a dead frame grey too, not just its names", () => {
    const frame = (id: string, parentId: string | null, isGarbage: boolean) => ({
      id,
      name: id === "Global" ? "global" : "f",
      parentId,
      bindings: [{ name: "n", value: { kind: "primitive" as const, display: "77", label: "int" } }],
      isGarbage,
    });
    const { root } = draw({
      frames: [frame("Global", null, false), frame("E1", "Global", true)],
      heap: [],
      activeFrameId: "Global",
    });
    const values = root.findAllByType(konva("konva-text")).filter(t => t.props.text === "77");
    expect(values.map(t => t.props.fill)).toEqual([DiagramColors.text, DiagramColors.garbage]);
  });

  describe("anchors for arrows from the program", () => {
    const anchored = () => {
      const onAnchors = vi.fn();
      const view = draw({ onAnchors });
      const latest = () => onAnchors.mock.calls.at(-1)![0];
      return { ...view, onAnchors, latest };
    };

    test("tell where an object or a frame is drawn, and where it is not", () => {
      const { latest } = anchored();
      const resolve = latest();
      const frame = resolve({ kind: "frame", id: "E1" });
      const object = resolve({ kind: "object", id: "#1" });
      expect(frame).toEqual({ x: expect.any(Number), y: expect.any(Number) });
      expect(object).toEqual({ x: expect.any(Number), y: expect.any(Number) });
      expect(resolve({ kind: "frame", id: "nope" })).toBeNull();
      expect(resolve({ kind: "object", id: "nope" })).toBeNull();
    });

    test("end at the horizontal centre of the top of an object, and the left edge of a frame", () => {
      const { latest } = anchored();
      const layout = layoutDiagram(step.frames, step.heap);
      const view = { scale: Math.min(1, 800 / layout.width, 600 / layout.height) };
      for (const box of layout.objects) {
        const at = latest()({ kind: "object", id: box.object.id });
        expect(at.x).toBeCloseTo((box.x + box.width / 2) * view.scale);
        expect(at.y).toBeCloseTo(box.y * view.scale);
      }
      const frame = layout.frames[1];
      const at = latest()({ kind: "frame", id: frame.frame.id });
      expect(at.x).toBeCloseTo(frame.x * view.scale);
    });

    test("follow the user's pan and zoom, and go away with the diagram", () => {
      const { root, onAnchors, latest } = anchored();
      const before = latest()({ kind: "frame", id: "E1" });
      act(() =>
        root
          .findByType(konva("konva-stage"))
          .props.onDragMove({ target: { x: () => 30, y: () => 40 } }),
      );
      const panned = latest()({ kind: "frame", id: "E1" });
      expect(panned).toEqual({ x: before.x + 30, y: before.y + 40 });
      act(() =>
        root
          .findByType(konva("konva-stage"))
          .props.onDragEnd({ target: { x: () => 30, y: () => 40 } }),
      );
      const wheel = {
        evt: { deltaY: -1, preventDefault: vi.fn() },
        target: { getStage: () => ({ getPointerPosition: () => ({ x: 0, y: 0 }) }) },
      };
      act(() => root.findByType(konva("konva-stage")).props.onWheel(wheel));
      expect(wheel.evt.preventDefault).toHaveBeenCalled();
      expect(latest()({ kind: "frame", id: "E1" })).not.toEqual(panned);
      expect(onAnchors).not.toHaveBeenLastCalledWith(null);
    });

    test("end when the diagram unmounts", () => {
      const onAnchors = vi.fn();
      let renderer!: TestRenderer.ReactTestRenderer;
      act(() => {
        renderer = TestRenderer.create(
          <EnvDiagram
            frames={step.frames}
            heap={step.heap}
            activeFrameId="Global"
            lookups={[]}
            hovered={null}
            onHover={vi.fn()}
            width={800}
            height={600}
            onAnchors={onAnchors}
          />,
        );
      });
      act(() => renderer.unmount());
      expect(onAnchors).toHaveBeenLastCalledWith(null);
    });
  });

  test("reports hovering over a frame, and draws a hovered frame highlighted", () => {
    const onHoverFrame = vi.fn();
    const { root } = draw({ onHoverFrame, hoveredFrame: "E2" });
    const frameGroups = root
      .findAllByType(konva("konva-group"))
      .filter(g => typeof g.props.onMouseEnter === "function" && "opacity" in g.props);
    act(() => frameGroups[0].props.onMouseEnter());
    expect(onHoverFrame).toHaveBeenLastCalledWith(step.frames[0].id);
    act(() => frameGroups[0].props.onMouseLeave());
    expect(onHoverFrame).toHaveBeenLastCalledWith(null);
    const highlighted = root
      .findAllByType(konva("konva-rect"))
      .filter(r => r.props.fill === DiagramColors.hoverBackground);
    expect(highlighted).toHaveLength(1);
    // Every frame box is filled, so its whole area takes the mouse.
    const boxes = root.findAllByType(konva("konva-rect")).filter(r => r.props.cornerRadius === 6);
    expect(boxes.length).toBe(step.frames.length);
    for (const box of boxes) expect(box.props.fill).toBeTruthy();
  });

  test("draws None in a list's box as a slash, not as text", () => {
    const { root } = draw({
      frames: [
        {
          id: "Global",
          name: "global",
          parentId: null,
          isGarbage: false,
          bindings: [
            { name: "xs", value: { kind: "ref", objectId: "#1" } },
            { name: "y", value: { kind: "primitive", display: "None", label: "None" } },
          ],
        },
      ],
      heap: [
        {
          kind: "list",
          id: "#1",
          isGarbage: false,
          elements: [
            { kind: "primitive", display: "3", label: "int" },
            // Whatever the type tag: py-slang sends "None", others may send "NoneType".
            { kind: "primitive", display: "None", label: "None" },
            { kind: "primitive", display: "None", label: "NoneType" },
            // A string reading None is not None.
            { kind: "primitive", display: "'None'", label: "str" },
          ],
        },
      ] as never,
      activeFrameId: "Global",
    });
    const texts = root.findAllByType(konva("konva-text")).map(t => t.props.text);
    // The binding y shows None; the list's box does not.
    expect(texts.filter(t => t === "None")).toHaveLength(1);
    expect(texts).toContain("3");
    expect(texts).toContain("'None'");
    const slashes = root
      .findAllByType(konva("konva-line"))
      .filter(l => l.props.points[1] > l.props.points[3]);
    expect(slashes).toHaveLength(2);
  });

  test("a hovered object gets a darker background, keeping its outline", () => {
    const { root } = draw({ hovered: "#2" });
    const darkened = root
      .findAllByType(konva("konva-circle"))
      .filter(c => c.props.fill === DiagramColors.hoverBackground);
    // The function object's two circles, outlined as usual.
    expect(darkened).toHaveLength(2);
    for (const c of darkened) expect(c.props.stroke).toBe(DiagramColors.stroke);
  });

  test("zooms around the pointer with the mouse wheel and remembers a pan", () => {
    const { root } = draw();
    const stage = root.findByType(konva("konva-stage"));
    const wheel = (deltaY: number) =>
      act(() =>
        stage.props.onWheel({
          evt: { deltaY, preventDefault: () => {} },
          target: { getStage: () => ({ getPointerPosition: () => ({ x: 100, y: 100 }) }) },
        }),
      );
    const scale = () => root.findByType(konva("konva-stage")).props.scaleX as number;
    const before = scale();
    wheel(-1);
    expect(scale()).toBeCloseTo(before * 1.1);
    wheel(1);
    expect(scale()).toBeCloseTo(before);
    act(() => stage.props.onDragEnd({ target: { x: () => 30, y: () => 40 } }));
    expect(root.findByType(konva("konva-stage")).props.x).toBe(30);
    expect(root.findByType(konva("konva-stage")).props.y).toBe(40);
  });
});
