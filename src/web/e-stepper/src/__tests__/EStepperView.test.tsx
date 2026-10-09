import type { CseDiagramViewProps } from "@sourceacademy/common-cse-machine";
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

  test("puts the panes side by side in a wide tab, with a divider that resizes the program pane", () => {
    // The tab's size, as the ResizeObservers report it (one for the tab, one for the diagram).
    const observers: ((entries: { contentRect: { width: number; height: number } }[]) => void)[] =
      [];
    const resize = (width: number) =>
      observers.forEach(callback => callback([{ contentRect: { width, height: 600 } }]));
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(callback: (typeof observers)[number]) {
          observers.push(callback);
        }
        observe() {}
        disconnect() {}
      },
    );
    const view = render({ steps: [fixture[1]], profile }, 1200);
    const main = view.root.find(n => hasClass(n, "estepper-main"));
    expect(hasClass(main, "narrow")).toBe(false);
    const left = () => view.root.find(n => hasClass(n, "estepper-left")).props.style.flex;
    // 1200px wide, of which 1182px are left for the panes (2 gaps of 8px, and 2px of divider).
    expect(left()).toBe(`0 0 ${Math.round(0.45 * 1182)}px`);
    const listeners: Record<string, (e: { clientX: number }) => void> = {};
    vi.stubGlobal("window", {
      addEventListener: (type: string, fn: (e: { clientX: number }) => void) =>
        (listeners[type] = fn),
      removeEventListener: (type: string) => delete listeners[type],
    });
    const divider = view.root.find(n => hasClass(n, "estepper-divider"));
    expect(hasClass(divider, "vertical")).toBe(true);
    act(() => divider.props.onPointerDown({ clientX: 600, preventDefault: () => {} }));
    act(() => listeners.pointermove({ clientX: 480 }));
    expect(left()).toBe(`0 0 ${Math.round(0.45 * 1182) - 120}px`);
    // Either pane keeps at least 200px.
    act(() => listeners.pointermove({ clientX: 0 }));
    expect(left()).toBe("0 0 200px");
    act(() => listeners.pointermove({ clientX: 2000 }));
    expect(left()).toBe(`0 0 ${1182 - 200}px`);
    act(() => listeners.pointerup({ clientX: 2000 }));
    expect(listeners.pointermove).toBeUndefined();
    // ...also when the tab is narrowed afterwards.
    act(() => resize(900));
    expect(left()).toBe(`0 0 ${900 - 18 - 200}px`);
    vi.unstubAllGlobals();
  });

  test("fills the height down to the bottom of the browser window", () => {
    let renderer!: TestRenderer.ReactTestRenderer;
    const element = <EStepperView steps={[fixture[1]]} profile={profile} />;
    act(() => {
      renderer = TestRenderer.create(element, {
        createNodeMock: () => ({
          getBoundingClientRect: () => ({ top: 200, width: 600, height: 600 }),
        }),
      });
    });
    const root = () => renderer.root.find(n => hasClass(n, "sa-e-stepper"));
    // (The test environment has no window until stubbed: then the height is worked out again.)
    const browser = { innerHeight: 1000, addEventListener() {}, removeEventListener() {} };
    vi.stubGlobal("window", browser);
    act(() => renderer.update(<EStepperView steps={[fixture[1]]} profile={profile} />));
    // From its top (200px) to the window's bottom (1000px), less a 16px gap...
    expect(root().props.style).toEqual({ height: 784 });
    // ...but never less than 400px.
    browser.innerHeight = 500;
    act(() => renderer.update(<EStepperView steps={[fixture[1]]} profile={profile} />));
    expect(root().props.style).toEqual({ height: 400 });
    vi.unstubAllGlobals();
  });

  test("the explanation takes the height of its text, whatever the host's styles", () => {
    const view = render({ steps: [fixture[1]], profile });
    const card = view.root.findAll(n => hasClass(n, "bp6-card") || hasClass(n, "bp5-card"))[0];
    expect(card.props.style).toMatchObject({ height: "auto", flex: "0 0 auto" });
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
      const createView = vi.fn((props: CseDiagramViewProps) =>
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

    test("gives it the frame colours, and shares the hovered frame with it", () => {
      const cseDiagram = service();
      // From the step inside the call of withdraw, which shows an environment bracket.
      const view = render({ steps: withCse.slice(1), profile, cseDiagram });
      const props = () => cseDiagram.createView.mock.calls.at(-1)![0];
      const first = withCse[1];
      expect(Object.keys(props().frameColors ?? {})).toEqual(first.frames.map(f => f.id));
      // The program's environment blocks report hovering...
      const label = view.root.findAll(n => hasClass(n, "estepper-envblock-label"))[0];
      const block = view.root.findAll(n => hasClass(n, "estepper-envblock"))[0];
      const stopPropagation = vi.fn();
      act(() => block.props.onMouseOver({ stopPropagation }));
      expect(props().hoveredFrame).toBe(text(label));
      // (the innermost block under the mouse: the event goes no further)
      expect(stopPropagation).toHaveBeenCalled();
      act(() => block.props.onMouseLeave());
      expect(props().hoveredFrame).toBeNull();
      // ...and a frame hovered in the diagram is highlighted in the program.
      act(() => props().onHoverFrame!(text(label)));
      expect(
        view.root.findAll(n => hasClass(n, "estepper-envblock") && hasClass(n, "hovered")),
      ).not.toHaveLength(0);
    });

    test("shares the hovered object with it", () => {
      const cseDiagram = service();
      const view = render({ steps: withCse, profile, cseDiagram });
      const { onHover } = cseDiagram.createView.mock.calls.at(-1)![0];
      act(() => onHover!("#1"));
      expect(cseDiagram.createView.mock.calls.at(-1)![0].hovered).toBe("#1");
      act(() => onHover!(null));
      expect(cseDiagram.createView.mock.calls.at(-1)![0].hovered).toBeNull();
      expect(view.root.findAllByType(konva("konva-stage"))).toHaveLength(0);
    });
  });
});
