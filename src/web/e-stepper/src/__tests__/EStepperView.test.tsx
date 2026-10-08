import type { EStepperStep, SyntaxProfile } from "@sourceacademy/common-e-stepper";
import { act, createElement } from "react";
import { Button } from "@blueprintjs/core";
import TestRenderer from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

// As in the data visualizer's tests: avoid Konva's Node build (it requires the optional `canvas`).
vi.mock("konva", () => ({ default: {} }));
vi.mock("react-konva", () => {
  const stub = (name: string) => (props: Record<string, unknown>) =>
    createElement(`konva-${name.toLowerCase()}`, props, props.children as never);
  return Object.fromEntries(
    ["Stage", "Layer", "Text", "Group", "Line", "Rect", "Circle", "Arrow"].map(n => [n, stub(n)]),
  );
});

import EStepperView from "../EStepperView";
import steps from "./makeWithdrawSteps.json";

/** A stubbed Konva shape's host element type (see the react-konva mock above). */
const konva = (type: string) => type as unknown as React.ElementType;
import pythonProfile from "./pythonProfile.json";

// Both produced by py-slang's e-stepper: three steps of make_withdraw, and its Python profile.
const fixture = steps as unknown as EStepperStep[];
const profile = pythonProfile as unknown as SyntaxProfile;

/** The last step's store, with a program that refers to the function object #2 and the list #4. */
const withRefs: EStepperStep = {
  ...fixture[2],
  ast: {
    type: "Program",
    nodeId: "p",
    body: [
      {
        type: "ExpressionStatement",
        nodeId: "s",
        expression: {
          type: "CallExpression",
          nodeId: "c",
          callee: {
            type: "Builtin",
            nodeId: "f",
            name: "print",
            hoverText: "built-in function print",
          },
          arguments: [
            { type: "Ref", nodeId: "r1", objectId: "#2" },
            { type: "Ref", nodeId: "r2", objectId: "#4" },
          ],
        },
      },
    ],
  },
};

/** Renders the view; every element reports `width` x 600 as its size (there is no DOM here). */
function render(props: Parameters<typeof EStepperView>[0], width = 600) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<EStepperView {...props} />, {
      createNodeMock: () => ({ getBoundingClientRect: () => ({ width, height: 600 }) }),
    });
  });
  return renderer;
}

/** Whether a node has the CSS class `name` (among its space-separated classes). */
const hasClass = (node: TestRenderer.ReactTestInstance, name: string): boolean =>
  typeof node.props.className === "string" && node.props.className.split(" ").includes(name);

const text = (node: TestRenderer.ReactTestInstance): string =>
  node.children.map(c => (typeof c === "string" ? c : text(c))).join("");

describe("EStepperView", () => {
  test("shows the welcome text before anything has run", () => {
    const view = render({ steps: [] });
    expect(text(view.root)).toContain("Welcome to the environment stepper");
  });

  test("shows a runner error", () => {
    const view = render({ steps: [], error: "NameError: name 'x' is not defined" });
    expect(text(view.root)).toContain("NameError: name 'x' is not defined");
  });

  test("renders a function body under evaluation as a bracket labelled with its frame", () => {
    const view = render({ steps: [fixture[1]], profile });
    const blocks = view.root.findAll(n => n.props.className === "estepper-envblock");
    expect(blocks).toHaveLength(1);
    const label = blocks[0].find(n => n.props.className === "estepper-envblock-label");
    expect(text(label)).toBe("E2");
  });

  test("renders references as badges, named function objects with their name", () => {
    const view = render({ steps: [withRefs], profile });
    expect(view.root.findAll(n => hasClass(n, "estepper-ref"))).toHaveLength(2);
    const badges = view.root.findAll(n => n.props.className === "estepper-ref-badge").map(text);
    expect(badges).toEqual(["#2", "#4"]);
    const names = view.root.findAll(n => n.props.className === "estepper-ref-name").map(text);
    expect(names).toEqual(["withdraw"]);
  });

  test("hovering a reference highlights it", () => {
    const view = render({ steps: [withRefs], profile });
    const [first] = view.root.findAll(n => hasClass(n, "estepper-ref"));
    act(() => first.props.onMouseEnter());
    const hovered = view.root.findAll(n => hasClass(n, "estepper-ref") && hasClass(n, "hovered"));
    expect(hovered).toHaveLength(1);
    expect(text(hovered[0])).toContain("#2");
    act(() => hovered[0].props.onMouseLeave());
    expect(view.root.findAll(n => hasClass(n, "hovered"))).toHaveLength(0);
  });

  test("shows the step's explanation and the program's output", () => {
    const view = render({ steps: [fixture[2]], profile });
    const all = text(view.root);
    expect(all).toContain("Evaluation complete");
    expect(all).toContain("Output");
    expect(all).toContain("50");
  });

  test("draws the environment diagram for the current step", () => {
    const view = render({ steps: [fixture[1]], profile });
    expect(view.root.findAllByType(konva("konva-stage"))).toHaveLength(1);
  });

  test("stacks the panes in a narrow tab, with a divider that resizes the program pane", () => {
    const view = render({ steps: [fixture[1]], profile });
    const main = view.root.find(n => hasClass(n, "estepper-main"));
    expect(hasClass(main, "narrow")).toBe(true);
    const listeners: Record<string, (e: { clientY: number }) => void> = {};
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: (e: { clientY: number }) => void) =>
        (listeners[type] = fn),
      removeEventListener: (type: string) => delete listeners[type],
    });
    const divider = view.root.find(n => hasClass(n, "estepper-divider"));
    act(() => divider.props.onPointerDown({ clientY: 100 }));
    act(() => listeners.pointermove({ clientY: 160 }));
    const left = view.root.find(n => hasClass(n, "estepper-left"));
    expect(left.props.style.flex).toBe("0 0 300px");
    act(() => listeners.pointerup({ clientY: 160 }));
    expect(listeners.pointermove).toBeUndefined();
    vi.unstubAllGlobals();
  });

  test("puts the panes side by side in a wide tab", () => {
    const view = render({ steps: [fixture[1]], profile }, 1200);
    const main = view.root.find(n => hasClass(n, "estepper-main"));
    expect(hasClass(main, "narrow")).toBe(false);
    expect(view.root.findAll(n => hasClass(n, "estepper-divider"))).toHaveLength(0);
  });

  test("steps with the buttons and the keyboard", () => {
    const view = render({ steps: fixture, profile });
    const explanation = () =>
      text(view.root.findAll(n => n.props.className === "result-output")[0]);
    const press = (key: string) =>
      act(() =>
        view.root
          .find(n => hasClass(n, "sa-e-stepper"))
          .props.onKeyDown({ key, preventDefault: () => {} }),
      );
    expect(explanation()).toBe("Start of evaluation");
    press("e");
    expect(explanation()).toBe("Evaluation complete");
    press("b");
    expect(explanation()).toBe("Assigned balance = 50 in frame E1");
    press("a");
    expect(explanation()).toBe("Start of evaluation");
    press("f");
    expect(explanation()).toBe("Assigned balance = 50 in frame E1");
    const buttons = view.root.findAllByType(Button);
    act(() => buttons[3].props.onClick());
    expect(explanation()).toBe("Evaluation complete");
    act(() => buttons[0].props.onClick());
    expect(explanation()).toBe("Start of evaluation");
  });

  test("the output strip can be collapsed", () => {
    const view = render({ steps: [fixture[2]], profile });
    const toggle = view.root.find(n => hasClass(n, "estepper-output-toggle"));
    act(() => toggle.props.onClick());
    expect(view.root.findAll(n => hasClass(n, "estepper-output"))).toHaveLength(0);
  });

  describe("with the host's CSE machine diagram", () => {
    const withCse = fixture.map((step, i) => ({
      ...step,
      cse: { stepIndex: i, control: [], stash: [], environments: [] },
    }));
    const service = () => {
      const createView = vi.fn((props: { snapshots: unknown[]; step: number }) =>
        createElement("host-cse-view", { "data-step": props.step }),
      );
      return { createView };
    };

    test("draws the environments with it, at the current step", () => {
      const cseDiagram = service();
      const view = render({ steps: withCse, profile, cseDiagram });
      expect(view.root.findAllByType(konva("konva-stage"))).toHaveLength(0);
      expect(view.root.findByType(konva("host-cse-view")).props["data-step"]).toBe(0);
      const call = cseDiagram.createView.mock.calls.at(-1)![0];
      expect(call.snapshots).toHaveLength(withCse.length);
      act(() =>
        view.root
          .find(n => hasClass(n, "sa-e-stepper"))
          .props.onKeyDown({ key: "e", preventDefault: () => {} }),
      );
      expect(view.root.findByType(konva("host-cse-view")).props["data-step"]).toBe(
        withCse.length - 1,
      );
    });

    test("falls back to its own diagram when the steps carry no CSE snapshots", () => {
      const cseDiagram = service();
      const view = render({ steps: fixture, profile, cseDiagram });
      expect(cseDiagram.createView).not.toHaveBeenCalled();
      expect(view.root.findAllByType(konva("konva-stage"))).toHaveLength(1);
    });
  });
});
