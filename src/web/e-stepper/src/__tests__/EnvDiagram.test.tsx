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
import steps from "./makeWithdrawSteps.json";

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
  root.findAllByType("konva-text").map(t => String(t.props.text));

describe("EnvDiagram", () => {
  test("draws every frame with its label and bindings", () => {
    const all = texts(draw().root);
    expect(all).toEqual(expect.arrayContaining(["Global", "E1  make_withdraw", "E2  withdraw"]));
    expect(all).toEqual(expect.arrayContaining(["balance:", "50", "amount:"]));
  });

  test("outlines the active frame", () => {
    const frameRects = draw()
      .root.findAllByType("konva-rect")
      .filter(r => r.props.cornerRadius === 6);
    const widths = frameRects.map(r => r.props.strokeWidth);
    expect(widths.filter(w => w === 4)).toHaveLength(1);
  });

  test("draws function objects as two circles and lists as boxes with their elements", () => {
    const { root } = draw();
    const all = texts(root);
    expect(all).toEqual(expect.arrayContaining(["#1 make_withdraw", "#2 withdraw", "#4", "#3"]));
    expect(all).toEqual(expect.arrayContaining(["1", "2"]));
    expect(root.findAllByType("konva-arrow").length).toBeGreaterThan(5);
  });

  test("highlights the bindings a step reads", () => {
    const { root } = draw({ lookups: [{ frameId: "E1", name: "balance" }] });
    const highlights = root
      .findAllByType("konva-rect")
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
      .findAllByType("konva-group")
      .filter(g => g.props.opacity === DiagramColors.garbageOpacity);
    expect(dimmed.length).toBeGreaterThan(0);
    const object = root
      .findAllByType("konva-group")
      .find(g => typeof g.props.onMouseEnter === "function")!;
    act(() => object.props.onMouseEnter());
    expect(onHover).toHaveBeenLastCalledWith(expect.stringMatching(/^#\d+$/));
    act(() => object.props.onMouseLeave());
    expect(onHover).toHaveBeenLastCalledWith(null);
  });

  test("a hovered object is drawn highlighted", () => {
    const { root } = draw({ hovered: "#2" });
    const hoveredCircles = root
      .findAllByType("konva-circle")
      .filter(c => c.props.stroke === DiagramColors.hover);
    expect(hoveredCircles).toHaveLength(2);
  });

  test("zooms around the pointer with the mouse wheel and remembers a pan", () => {
    const { root } = draw();
    const stage = root.findByType("konva-stage");
    const wheel = (deltaY: number) =>
      act(() =>
        stage.props.onWheel({
          evt: { deltaY, preventDefault: () => {} },
          target: { getStage: () => ({ getPointerPosition: () => ({ x: 100, y: 100 }) }) },
        }),
      );
    const scale = () => root.findByType("konva-stage").props.scaleX as number;
    const before = scale();
    wheel(-1);
    expect(scale()).toBeCloseTo(before * 1.1);
    wheel(1);
    expect(scale()).toBeCloseTo(before);
    act(() => stage.props.onDragEnd({ target: { x: () => 30, y: () => 40 } }));
    expect(root.findByType("konva-stage").props.x).toBe(30);
    expect(root.findByType("konva-stage").props.y).toBe(40);
  });
});
