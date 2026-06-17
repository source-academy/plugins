import { describe, it, expect } from "vitest";
import { CSE_MESSAGE_TYPE_SNAPSHOTS, type CseSnapshot } from "../index";

describe("common-cse-machine", () => {
  it("a snapshot is structured-clone-able", () => {
    const snap: CseSnapshot = {
      stepIndex: 0,
      control: [{ displayText: "x + 1" }],
      stash: [{ displayValue: "1", label: "number" }],
      environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
      currentLine: 1,
    };
    const msg = { type: CSE_MESSAGE_TYPE_SNAPSHOTS, snapshots: [snap], totalSteps: 1 };
    expect(structuredClone(msg)).toEqual(msg);
  });
});
