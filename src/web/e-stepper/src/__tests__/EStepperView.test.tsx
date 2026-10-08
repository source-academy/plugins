import type { EStepperStep, SyntaxProfile } from "@sourceacademy/common-e-stepper";
import { act } from "react";
import TestRenderer from "react-test-renderer";
import { describe, expect, test, vi } from "vitest";

// As in the data visualizer's tests: avoid Konva's Node build (it requires the optional `canvas`).
vi.mock("konva", () => ({ default: {} }));
vi.mock("react-konva", () => {
  const stub = (name: string) => {
    const fn = () => null;
    Object.defineProperty(fn, "name", { value: name });
    return fn;
  };
  return {
    Stage: stub("Stage"),
    Layer: stub("Layer"),
    Text: stub("Text"),
    Group: stub("Group"),
    Line: stub("Line"),
    Rect: stub("Rect"),
    Circle: stub("Circle"),
    Arrow: stub("Arrow"),
  };
});

import EStepperView from "../EStepperView";
import steps from "./makeWithdrawSteps.json";
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

function render(props: Parameters<typeof EStepperView>[0]) {
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<EStepperView {...props} />);
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
});
