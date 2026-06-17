import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  RUNNER_ID,
  WEB_ID,
  type CseSnapshot,
} from "../index";

describe("common-cse-machine", () => {
  it("exposes stable channel and plugin ids", () => {
    expect(CSE_CHANNEL).toBe("__cse");
    expect(RUNNER_ID).toBe("__runner_cse");
    expect(WEB_ID).toBe("__web_cse");
  });

  it("a snapshot is structured-clone-able", () => {
    const snap: CseSnapshot = {
      stepIndex: 0,
      control: [{ displayText: "x + 1" }],
      stash: [{ displayValue: "1", label: "number" }],
      environments: [
        { id: "g", name: "global", parentId: null, bindings: [], isActive: true },
      ],
      currentLine: 1,
    };
    const msg = { type: CSE_MESSAGE_TYPE_SNAPSHOTS, snapshots: [snap], totalSteps: 1 };
    expect(structuredClone(msg)).toEqual(msg);
  });
});
