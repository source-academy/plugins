import type { EStepperMessage, EStepperStep } from "@sourceacademy/common-e-stepper";
import { act, createElement } from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

vi.mock("konva", () => ({ default: {} }));
vi.mock("react-konva", () => {
  const stub = (name: string) => (props: Record<string, unknown>) =>
    createElement(`konva-${name.toLowerCase()}`, props, props.children as never);
  return Object.fromEntries(
    ["Stage", "Layer", "Text", "Group", "Line", "Rect", "Circle", "Arrow"].map(n => [n, stub(n)]),
  );
});

import { EStepperHostPlugin } from "../EStepperHostPlugin";
import steps from "./makeWithdrawSteps.json";

function setUp(hostServices?: ConstructorParameters<typeof EStepperHostPlugin>[3]) {
  let deliver!: (message: EStepperMessage) => void;
  const sent: EStepperMessage[] = [];
  const channel = {
    name: "__e_stepper",
    subscribe: (fn: (message: EStepperMessage) => void) => (deliver = fn),
    unsubscribe: () => {},
    send: (message: EStepperMessage) => sent.push(message),
    close: () => {},
  };
  let tab!: { id: string; label: string; iconName: string; body: React.ReactNode };
  const tabService = { registerTab: (t: typeof tab) => (tab = t), revealTab: vi.fn() };
  const plugin = new EStepperHostPlugin({}, [channel as never], tabService, hostServices);
  return { plugin, deliver: (m: EStepperMessage) => act(() => deliver(m)), sent, tab, tabService };
}

describe("EStepperHostPlugin", () => {
  test("registers and reveals the E-Stepper tab, and asks for the last run's steps", () => {
    const { tab, tabService, sent } = setUp();
    expect(tab).toMatchObject({ id: "e-stepper", label: "E-Stepper", iconName: "flow-review" });
    expect(tabService.revealTab).toHaveBeenCalledWith("e-stepper");
    expect(sent).toEqual([{ type: "request" }]);
  });

  test("keeps the latest steps or error", () => {
    const { plugin, deliver } = setUp();
    deliver({ type: "steps", steps: steps as unknown as EStepperStep[] });
    expect(plugin.getState().steps).toHaveLength(3);
    deliver({ type: "error", error: "SyntaxError" });
    expect(plugin.getState()).toMatchObject({ steps: [], error: "SyntaxError" });
  });

  test("lends the host's CSE diagram to the tab", () => {
    const createView = vi.fn(() => createElement("host-cse-view"));
    const { tab, deliver } = setUp({ cseDiagram: { createView } });
    let view!: TestRenderer.ReactTestRenderer;
    act(() => {
      view = TestRenderer.create(tab.body as React.ReactElement, {
        createNodeMock: () => ({ getBoundingClientRect: () => ({ width: 600, height: 600 }) }),
      });
    });
    deliver({
      type: "steps",
      steps: (steps as unknown as EStepperStep[]).map((s, i) => ({
        ...s,
        cse: { stepIndex: i, control: [], stash: [], environments: [] },
      })),
    });
    expect(createView).toHaveBeenCalled();
    expect(view.root.findAllByType("host-cse-view" as unknown as React.ElementType)).toHaveLength(
      1,
    );
  });
});
