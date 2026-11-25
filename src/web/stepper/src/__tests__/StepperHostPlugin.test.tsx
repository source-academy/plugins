import type {
  SerializedStepperStep,
  StepperMessage,
  SyntaxProfile,
} from "@sourceacademy/common-stepper";
import type { Tab } from "@sourceacademy/common-tabs";
import { act, createElement } from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

// The view itself is tested in SubstVisualizer.test.tsx; here it only shows what it was given.
vi.mock("../SubstVisualizer", () => ({
  default: (props: { content: unknown[]; profile?: { name: string } }) =>
    createElement("div", {
      "data-steps": props.content.length,
      "data-profile": props.profile?.name,
    }),
}));

import { StepperHostPlugin } from "../StepperHostPlugin";

type PluginArgs = ConstructorParameters<typeof StepperHostPlugin>;

const steps = [{}, {}, {}] as unknown as SerializedStepperStep[];
const profile = { name: "python" } as unknown as SyntaxProfile;

function setUp() {
  let deliver!: (message: StepperMessage) => void;
  const sent: StepperMessage[] = [];
  const channel = {
    name: "__stepper",
    subscribe: (fn: (message: StepperMessage) => void) => (deliver = fn),
    unsubscribe: () => {},
    send: (message: StepperMessage) => sent.push(message),
    close: () => {},
  };
  let tab!: Tab;
  const tabService = { registerTab: (t: Tab) => (tab = t), revealTab: vi.fn() };
  const plugin = new StepperHostPlugin({} as PluginArgs[0], [channel], tabService);
  return { plugin, tab, tabService, sent, deliver: (m: StepperMessage) => act(() => deliver(m)) };
}

describe("StepperHostPlugin", () => {
  test("registers and reveals the Stepper tab, and asks for the last run's steps", () => {
    const { tab, tabService, sent } = setUp();
    expect(tab).toMatchObject({ id: "stepper", label: "Stepper", iconName: "flow-review" });
    expect(tabService.revealTab).toHaveBeenCalledWith("stepper");
    expect(sent).toEqual([{ type: "request" }]);
  });

  test("tells the host to hide its REPL and to keep the side content's size", () => {
    expect(setUp().tab).toMatchObject({ hidesRepl: true, resizable: false });
  });

  test("keeps the latest steps and profile, and tells its listeners", () => {
    const { plugin, deliver } = setUp();
    const listener = vi.fn();
    plugin.subscribe(listener);
    deliver({ type: "steps", steps, profile });
    expect(plugin.getSteps()).toBe(steps);
    expect(plugin.getProfile()).toBe(profile);
    expect(plugin.getError()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test("an error replaces the steps, and the next steps clear the error", () => {
    const { plugin, deliver } = setUp();
    deliver({ type: "steps", steps, profile });
    deliver({ type: "error", error: "SyntaxError" });
    expect(plugin.getSteps()).toEqual([]);
    expect(plugin.getError()).toBe("SyntaxError");
    deliver({ type: "steps", steps });
    expect(plugin.getError()).toBeNull();
    expect(plugin.getSteps()).toBe(steps);
  });

  test("a listener that unsubscribed hears nothing more", () => {
    const { plugin, deliver } = setUp();
    const listener = vi.fn();
    const unsubscribe = plugin.subscribe(listener);
    unsubscribe();
    deliver({ type: "steps", steps });
    expect(listener).not.toHaveBeenCalled();
  });

  test("the tab shows the steps it has received", () => {
    const { tab, deliver } = setUp();
    let renderer!: TestRenderer.ReactTestRenderer;
    act(() => {
      renderer = TestRenderer.create(tab.body as React.ReactElement);
    });
    expect(renderer.root.findByType("div").props["data-steps"]).toBe(0);
    deliver({ type: "steps", steps, profile });
    expect(renderer.root.findByType("div").props["data-steps"]).toBe(3);
    expect(renderer.root.findByType("div").props["data-profile"]).toBe("python");
  });

  describe("batches", () => {
    const first = [{}, {}] as unknown as SerializedStepperStep[];
    const second = [{}] as unknown as SerializedStepperStep[];

    test("each batch continues the steps before it, and the first one brings the profile", () => {
      const { plugin, deliver } = setUp();
      const listener = vi.fn();
      plugin.subscribe(listener);
      deliver({ type: "batch", index: 0, steps: first, profile });
      expect(plugin.getSteps()).toHaveLength(2);
      expect(plugin.getProfile()).toBe(profile);
      expect(plugin.getEnd()).toBeUndefined();
      deliver({ type: "batch", index: 2, steps: second });
      expect(plugin.getSteps()).toHaveLength(3);
      expect(plugin.getProfile()).toBe(profile);
      expect(listener).toHaveBeenCalledTimes(2);
    });

    test("the last batch says how the trace ended", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "batch", index: 0, steps: first });
      deliver({
        type: "batch",
        index: 2,
        steps: [],
        end: { status: "cut-off", reason: "too long" },
      });
      expect(plugin.getEnd()).toEqual({ status: "cut-off", reason: "too long" });
      expect(plugin.getSteps()).toHaveLength(2);
    });

    test("a batch at index 0 starts the run afresh", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "batch", index: 0, steps: first, end: { status: "complete" } });
      deliver({ type: "batch", index: 0, steps: second });
      expect(plugin.getSteps()).toHaveLength(1);
      expect(plugin.getEnd()).toBeUndefined();
      expect(plugin.getProfile()).toBeUndefined();
    });

    test("a batch that does not continue the steps received is dropped", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "batch", index: 0, steps: first });
      deliver({ type: "batch", index: 5, steps: second });
      expect(plugin.getSteps()).toHaveLength(2);
    });

    test("a trace sent whole is a complete one, and a batch after the end of a run replays over it", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "steps", steps: first });
      expect(plugin.getEnd()).toEqual({ status: "complete" });
      // The replay of a streamed run (on request) is one batch from index 0, with its end.
      deliver({ type: "batch", index: 0, steps: second, end: { status: "complete" } });
      expect(plugin.getSteps()).toHaveLength(1);
      expect(plugin.getEnd()).toEqual({ status: "complete" });
    });

    test("a stopped run keeps the steps it had, with no end", () => {
      const { plugin, deliver } = setUp();
      deliver({ type: "batch", index: 0, steps: first });
      expect(plugin.getSteps()).toHaveLength(2);
      expect(plugin.getEnd()).toBeUndefined();
      expect(plugin.getError()).toBeNull();
    });
  });
});
