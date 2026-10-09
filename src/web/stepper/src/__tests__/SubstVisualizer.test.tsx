/**
 * The stepper's step slider: it counts the steps taken, from 0 (the start) to the last, as in the
 * e-stepper and the CSE machine, and labels both ends.
 */
import { Button, Slider } from "@blueprintjs/core";
import type { SerializedStepperStep } from "@sourceacademy/common-stepper";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

// The hotkey library needs react-dom, which it does not declare (so it does not resolve here).
vi.mock("@mantine/hooks", () => ({ getHotkeyHandler: () => () => {} }));

import { sliderLabels } from "../sliderLabels";
import StepperView from "../SubstVisualizer";

const step = (explanation: string): SerializedStepperStep => ({
  ast: { type: "Program", nodeId: "p", body: [] },
  markers: [{ explanation }],
});
const run = (n: number) => Array.from({ length: n }, (_, i) => step(`step ${i}`));

function render(content: SerializedStepperStep[]) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<StepperView content={content} />);
  });
  return renderer;
}

describe("the step slider", () => {
  test("counts from 0 to the number of steps taken, and labels both ends", () => {
    const view = render(run(174));
    const slider = () => view.root.findByType(Slider);
    expect(slider().props.min).toBe(0);
    expect(slider().props.max).toBe(173);
    expect(slider().props.value).toBe(0);
    const labels = slider().props.labelValues as number[];
    expect(labels[0]).toBe(0);
    expect(labels.at(-1)).toBe(173);
    act(() => slider().props.onChange(173));
    expect(slider().props.value).toBe(173);
    // The explanation shown is that of the 174th step, the last.
    expect(JSON.stringify(view.toJSON())).toContain("step 173");
  });

  test("the buttons step, and the double arrows go to the first and the last step", () => {
    const view = render(run(10));
    const slider = () => view.root.findByType(Slider).props.value as number;
    const button = (icon: string) =>
      view.root.findAllByType(Button).find(b => b.props.icon === icon)!;
    act(() => button("chevron-right").props.onClick());
    expect(slider()).toBe(1);
    act(() => button("double-chevron-right").props.onClick());
    expect(slider()).toBe(9);
    act(() => button("double-chevron-left").props.onClick());
    expect(slider()).toBe(0);
  });

  test("a run of one step gives the slider a valid range, disabled", () => {
    const slider = render(run(1)).root.findByType(Slider);
    expect(slider.props.min).toBe(0);
    expect(slider.props.max).toBe(1);
    expect(slider.props.disabled).toBe(true);
    expect(render(run(2)).root.findByType(Slider).props.disabled).toBe(false);
  });
});

describe("sliderLabels", () => {
  test("labels 0, a round step apart, and always the last, never crowding it", () => {
    expect(sliderLabels(0)).toEqual([0]);
    expect(sliderLabels(1)).toEqual([0, 1]);
    expect(sliderLabels(10)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(sliderLabels(173).slice(0, 3)).toEqual([0, 18, 36]);
    expect(sliderLabels(173).at(-1)).toBe(173);
    expect(sliderLabels(37)).toEqual([0, 4, 8, 12, 16, 20, 24, 28, 32, 37]);
  });
});
