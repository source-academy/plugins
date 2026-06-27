import { describe, it, expect } from "vitest";
import {
  CSE_CHANNEL,
  CSE_DIRECTORY_ID,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  RUNNER_ID,
  WEB_ID,
  type CseSnapshot,
  type CseSnapshotMessage,
  type CseSerializedValue,
  type CseSerializedInstruction,
  type CseSerializedEnvFrame,
  type CseSerializedBinding,
} from "../index";

// ── Constants ─────────────────────────────────────────────────────────────────

describe("constants", () => {
  it("CSE_CHANNEL has the expected value", () => {
    expect(CSE_CHANNEL).toBe("__cse");
  });

  it("RUNNER_ID has the expected value", () => {
    expect(RUNNER_ID).toBe("__runner_cse");
  });

  it("WEB_ID has the expected value", () => {
    expect(WEB_ID).toBe("__web_cse");
  });

  it("CSE_DIRECTORY_ID has the expected value", () => {
    expect(CSE_DIRECTORY_ID).toBe("cse-machine");
  });

  it("CSE_MESSAGE_TYPE_SNAPSHOTS has the expected value", () => {
    expect(CSE_MESSAGE_TYPE_SNAPSHOTS).toBe("snapshots");
  });

  it("RUNNER_ID and WEB_ID are distinct", () => {
    expect(RUNNER_ID).not.toBe(WEB_ID);
  });
});

// ── Structured-clone safety ───────────────────────────────────────────────────

describe("structured-clone safety", () => {
  it("a minimal snapshot survives structuredClone", () => {
    const snap: CseSnapshot = {
      stepIndex: 0,
      control: [],
      stash: [],
      environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
    };
    expect(structuredClone(snap)).toEqual(snap);
  });

  it("a fully-populated snapshot survives structuredClone", () => {
    const snap: CseSnapshot = {
      stepIndex: 2,
      control: [
        { displayText: "call f", tag: "app", metadata: { instrType: "Application", numOfArgs: 1 } },
      ],
      stash: [{ displayValue: "42", label: "number", tag: "int", metadata: { raw: 42 } }],
      environments: [
        {
          id: "e1",
          name: "f",
          parentId: "g",
          bindings: [{ name: "x", value: { displayValue: "1", label: "number" }, isConst: true }],
          heapObjects: [{ displayValue: "<closure>", label: "closure" }],
          isActive: true,
          isOnCallStack: true,
          closureFrameId: "g",
        },
        { id: "g", name: "global", parentId: null, bindings: [], isActive: false },
      ],
      currentLine: 3,
    };
    expect(structuredClone(snap)).toEqual(snap);
  });

  it("a CseSnapshotMessage with multiple snapshots survives structuredClone", () => {
    const msg: CseSnapshotMessage = {
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots: [
        { stepIndex: 0, control: [], stash: [], environments: [], currentLine: 1 },
        { stepIndex: 1, control: [{ displayText: "pop" }], stash: [], environments: [] },
      ],
      totalSteps: 2,
    };
    expect(structuredClone(msg)).toEqual(msg);
  });
});

// ── CseSnapshotMessage ────────────────────────────────────────────────────────

describe("CseSnapshotMessage", () => {
  it("totalSteps matches snapshots.length for a batch", () => {
    const snapshots: CseSnapshot[] = [
      { stepIndex: 0, control: [], stash: [], environments: [] },
      { stepIndex: 1, control: [], stash: [], environments: [] },
      { stepIndex: 2, control: [], stash: [], environments: [] },
    ];
    const msg: CseSnapshotMessage = {
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots,
      totalSteps: snapshots.length,
    };
    expect(msg.totalSteps).toBe(3);
    expect(msg.snapshots.length).toBe(msg.totalSteps);
  });

  it("accepts an empty snapshots array", () => {
    const msg: CseSnapshotMessage = {
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots: [],
      totalSteps: 0,
    };
    expect(msg.snapshots).toHaveLength(0);
    expect(msg.totalSteps).toBe(0);
  });

  it("type discriminator is CSE_MESSAGE_TYPE_SNAPSHOTS", () => {
    const msg: CseSnapshotMessage = {
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots: [],
      totalSteps: 0,
    };
    expect(msg.type).toBe(CSE_MESSAGE_TYPE_SNAPSHOTS);
  });
});

// ── CseSnapshot optional fields ───────────────────────────────────────────────

describe("CseSnapshot optional fields", () => {
  it("currentLine is optional and may be omitted", () => {
    const snap: CseSnapshot = {
      stepIndex: 0,
      control: [],
      stash: [],
      environments: [],
    };
    expect(snap.currentLine).toBeUndefined();
  });

  it("currentLine is preserved when set", () => {
    const snap: CseSnapshot = {
      stepIndex: 5,
      control: [],
      stash: [],
      environments: [],
      currentLine: 12,
    };
    expect(snap.currentLine).toBe(12);
  });

  it("stepIndex is preserved across multiple steps", () => {
    const indices = [0, 1, 2, 10, 99];
    const steps = indices.map(i => ({
      stepIndex: i,
      control: [],
      stash: [],
      environments: [],
    }));
    steps.forEach((s, i) => expect(s.stepIndex).toBe(indices[i]));
  });
});

// ── CseSerializedValue ────────────────────────────────────────────────────────

describe("CseSerializedValue", () => {
  it("accepts minimal value with displayValue and label only", () => {
    const v: CseSerializedValue = { displayValue: "true", label: "bool" };
    expect(v.tag).toBeUndefined();
    expect(v.metadata).toBeUndefined();
  });

  it("accepts value with all optional fields", () => {
    const v: CseSerializedValue = {
      displayValue: "<closure>",
      label: "closure",
      tag: "fn",
      metadata: { closureFrameId: "e1", params: ["x", "y"] },
    };
    expect(v.displayValue).toBe("<closure>");
    expect(v.metadata).toEqual({ closureFrameId: "e1", params: ["x", "y"] });
  });
});

// ── CseSerializedInstruction ──────────────────────────────────────────────────

describe("CseSerializedInstruction", () => {
  it("accepts minimal instruction with displayText only", () => {
    const instr: CseSerializedInstruction = { displayText: "pop" };
    expect(instr.tag).toBeUndefined();
    expect(instr.metadata).toBeUndefined();
  });

  it("accepts instruction with metadata for animation dispatch", () => {
    const instr: CseSerializedInstruction = {
      displayText: "call f",
      metadata: { instrType: "Application", numOfArgs: 2, startLine: 4, endLine: 4 },
    };
    expect(instr.metadata).toEqual({
      instrType: "Application",
      numOfArgs: 2,
      startLine: 4,
      endLine: 4,
    });
  });
});

// ── CseSerializedEnvFrame ─────────────────────────────────────────────────────

describe("CseSerializedEnvFrame", () => {
  it("root frame has null parentId", () => {
    const frame: CseSerializedEnvFrame = {
      id: "g",
      name: "global",
      parentId: null,
      bindings: [],
      isActive: true,
    };
    expect(frame.parentId).toBeNull();
  });

  it("child frame references parent by id", () => {
    const frame: CseSerializedEnvFrame = {
      id: "e1",
      name: "f",
      parentId: "g",
      bindings: [],
      isActive: true,
    };
    expect(frame.parentId).toBe("g");
  });

  it("optional fields are absent when not set", () => {
    const frame: CseSerializedEnvFrame = {
      id: "g",
      name: "global",
      parentId: null,
      bindings: [],
      isActive: false,
    };
    expect(frame.heapObjects).toBeUndefined();
    expect(frame.isOnCallStack).toBeUndefined();
    expect(frame.closureFrameId).toBeUndefined();
  });

  it("heapObjects carries anonymous closures not bound to a name", () => {
    const frame: CseSerializedEnvFrame = {
      id: "g",
      name: "global",
      parentId: null,
      bindings: [],
      isActive: true,
      heapObjects: [{ displayValue: "<closure>", label: "closure" }],
    };
    expect(frame.heapObjects).toHaveLength(1);
  });

  it("closureFrameId links a frame to its defining environment", () => {
    const frame: CseSerializedEnvFrame = {
      id: "e2",
      name: "lambda",
      parentId: "g",
      bindings: [],
      isActive: false,
      closureFrameId: "g",
    };
    expect(frame.closureFrameId).toBe("g");
  });
});

// ── CseSerializedBinding ──────────────────────────────────────────────────────

describe("CseSerializedBinding", () => {
  it("isConst is optional and defaults to undefined", () => {
    const b: CseSerializedBinding = {
      name: "x",
      value: { displayValue: "5", label: "number" },
    };
    expect(b.isConst).toBeUndefined();
  });

  it("marks const bindings explicitly", () => {
    const b: CseSerializedBinding = {
      name: "PI",
      value: { displayValue: "3.14159", label: "number" },
      isConst: true,
    };
    expect(b.isConst).toBe(true);
  });

  it("marks mutable bindings explicitly", () => {
    const b: CseSerializedBinding = {
      name: "counter",
      value: { displayValue: "0", label: "number" },
      isConst: false,
    };
    expect(b.isConst).toBe(false);
  });
});
