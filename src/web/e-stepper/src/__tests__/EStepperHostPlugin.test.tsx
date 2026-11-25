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

// Blueprint's overlays need a DOM to unmount (the options menu goes when the host draws the diagram).
vi.mock("@blueprintjs/core", async (importOriginal: () => Promise<object>) => ({
  ...(await importOriginal()),
  Popover: (props: Record<string, unknown>) => createElement("popover-stub", props),
}));

import { EStepperHostPlugin } from "../EStepperHostPlugin";
import steps from "./makeWithdrawSteps.json";

type PluginArgs = ConstructorParameters<typeof EStepperHostPlugin>;

function setUp(hostServices?: PluginArgs[3]) {
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
  // Stubs with only what the plugin uses.
  const conduit = {} as PluginArgs[0];
  const tabServiceStub = tabService as unknown as PluginArgs[2];
  const plugin = new EStepperHostPlugin(conduit, [channel as never], tabServiceStub, hostServices);
  return { plugin, deliver: (m: EStepperMessage) => act(() => deliver(m)), sent, tab, tabService };
}

describe("EStepperHostPlugin", () => {
  test("registers and reveals the E-Stepper tab, and asks for the last run's steps", () => {
    const { tab, tabService, sent } = setUp();
    expect(tab).toMatchObject({ id: "e-stepper", label: "E-Stepper", iconName: "flow-review" });
    // The host hides its REPL and fixes the side content's size while this tab is open.
    expect(tab).toMatchObject({ hidesRepl: true, resizable: false });
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

  describe("batches", () => {
    const some = steps as unknown as EStepperStep[];
    const one = some.slice(0, 1);
    const rest = some.slice(1);

    test("each batch continues the steps before it, and the end is kept", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "batch", index: 0, steps: one });
      expect(plugin.getState().steps).toHaveLength(1);
      expect(plugin.getState().end).toBeUndefined();
      deliver({ type: "batch", index: 1, steps: rest, end: { status: "complete" } });
      expect(plugin.getState().steps).toHaveLength(some.length);
      expect(plugin.getState().end).toEqual({ status: "complete" });
    });

    test("a cut-off trace keeps its steps and says why", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "batch", index: 0, steps: some });
      deliver({
        type: "batch",
        index: some.length,
        steps: [],
        end: { status: "cut-off", reason: "too long" },
      });
      expect(plugin.getState()).toMatchObject({
        error: null,
        end: { status: "cut-off", reason: "too long" },
      });
      expect(plugin.getState().steps).toHaveLength(some.length);
    });

    test("a batch at index 0 starts the run afresh, and one that skips ahead is dropped", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "batch", index: 0, steps: some, end: { status: "complete" } });
      deliver({ type: "batch", index: 0, steps: one });
      expect(plugin.getState().steps).toHaveLength(1);
      expect(plugin.getState().end).toBeUndefined();
      deliver({ type: "batch", index: 9, steps: rest });
      expect(plugin.getState().steps).toHaveLength(1);
    });

    test("a trace sent whole is a complete one", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "steps", steps: some });
      expect(plugin.getState().end).toEqual({ status: "complete" });
    });
  });
});
