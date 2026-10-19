import type {
  EStepperFrame,
  EStepperHeapObject,
  EStepperStep,
} from "@sourceacademy/common-e-stepper";
import { describe, expect, test } from "vitest";

import { storeAt } from "../store";

const frame = (id: string, isGarbage = false, value = "1"): EStepperFrame => ({
  id,
  name: id === "Global" ? "global" : "f",
  parentId: id === "Global" ? null : "Global",
  bindings: [{ name: "x", value: { kind: "primitive", display: value, label: "int" } }],
  isGarbage,
});
const list = (id: string, isGarbage = false): EStepperHeapObject => ({
  kind: "list",
  id,
  elements: [],
  isGarbage,
});
const step = (frames: EStepperFrame[], heap: EStepperHeapObject[] = []): EStepperStep => ({
  ast: { type: "Program", nodeId: "p", body: [] },
  frames,
  heap,
  activeFrameId: "Global",
});
const ids = (items: { id: string; isGarbage: boolean }[]) =>
  items.map(i => `${i.id}${i.isGarbage ? "!" : ""}`);

// E1 is live in step 0, becomes unreachable in step 1, E2 in step 2; the steps after the one in
// which an item becomes unreachable do not have it.
const steps = [
  step([frame("Global"), frame("E1")], [list("#1")]),
  step([frame("Global"), frame("E1", true), frame("E2")], [list("#1", true), list("#2")]),
  step([frame("Global"), frame("E2", true), frame("E3")], [list("#2", true)]),
  step([frame("Global"), frame("E3")], []),
];

describe("storeAt", () => {
  test("the frames and objects of the earlier steps that the step does not have are unreachable", () => {
    expect(ids(storeAt(steps, 0).frames)).toEqual(["Global", "E1"]);
    expect(ids(storeAt(steps, 1).frames)).toEqual(["Global", "E1!", "E2"]);
    expect(ids(storeAt(steps, 2).frames)).toEqual(["Global", "E1!", "E2!", "E3"]);
    expect(ids(storeAt(steps, 3).frames)).toEqual(["Global", "E1!", "E2!", "E3"]);
    expect(ids(storeAt(steps, 3).heap)).toEqual(["#1!", "#2!"]);
  });

  test("moving back and forth gives the same store", () => {
    const at = (i: number) => JSON.stringify(storeAt(steps, i));
    const forward = [0, 1, 2, 3].map(at);
    expect([3, 2, 1, 0].map(at).reverse()).toEqual(forward);
    expect([2, 0, 3, 1].map(i => at(i))).toEqual([2, 0, 3, 1].map(i => forward[i]));
  });

  test("the latest version of a frame is used", () => {
    const changed = [
      step([frame("Global"), frame("E1", false, "1")]),
      step([frame("Global"), frame("E1", true, "2")]),
      step([frame("Global")]),
    ];
    const e1 = storeAt(changed, 2).frames.find(f => f.id === "E1")!;
    expect(e1.isGarbage).toBe(true);
    expect(e1.bindings[0].value).toEqual({ kind: "primitive", display: "2", label: "int" });
  });

  test("an evaluator that repeats the unreachable ones in every step gives the same store", () => {
    const repeated = [
      step([frame("Global"), frame("E1")], [list("#1")]),
      step([frame("Global"), frame("E1", true), frame("E2")], [list("#1", true), list("#2")]),
      step(
        [frame("Global"), frame("E1", true), frame("E2", true), frame("E3")],
        [list("#1", true), list("#2", true)],
      ),
      step(
        [frame("Global"), frame("E1", true), frame("E2", true), frame("E3")],
        [list("#1", true), list("#2", true)],
      ),
    ];
    for (let i = 0; i < steps.length; i++) {
      expect(storeAt(repeated, i)).toEqual(storeAt(steps, i));
    }
  });

  test("frames are in creation order, the global frame first", () => {
    const shuffled = [
      step([frame("E10"), frame("E2"), frame("Global")], [list("#10"), list("#9")]),
    ];
    expect(ids(storeAt(shuffled, 0).frames)).toEqual(["Global", "E2", "E10"]);
    expect(ids(storeAt(shuffled, 0).heap)).toEqual(["#9", "#10"]);
  });
});
