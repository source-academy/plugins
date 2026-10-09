import { expect, test } from "vitest";

import { RUNNER_ID as STEPPER_RUNNER_ID, STEPPER_CHANNEL_ID } from "@sourceacademy/common-stepper";
import {
  E_STEPPER_CHANNEL_ID,
  E_STEPPER_DIRECTORY_ID,
  ENV_BLOCK_NODE_TYPE,
  REF_NODE_TYPE,
  RUNNER_ID,
  WEB_ID,
  isEnvBlockNode,
  isRefNode,
  type EStepperStep,
} from "..";

test("runner and web ids are distinct", () => {
  expect(RUNNER_ID).not.toBe(WEB_ID);
});

test("has stable ids, distinct from the stepper's", () => {
  expect(E_STEPPER_CHANNEL_ID).toBe("__e_stepper");
  expect(E_STEPPER_DIRECTORY_ID).toBe("e-stepper");
  expect(E_STEPPER_CHANNEL_ID).not.toBe(STEPPER_CHANNEL_ID);
  expect(RUNNER_ID).not.toBe(STEPPER_RUNNER_ID);
});

test("type guards recognise EnvBlock and Ref nodes", () => {
  const ref = { type: REF_NODE_TYPE, nodeId: "1", objectId: "#1" };
  const block = { type: ENV_BLOCK_NODE_TYPE, nodeId: "2", envId: "E1", body: [ref] };
  const literal = { type: "Literal", nodeId: "3", value: 1 };
  expect(isRefNode(ref)).toBe(true);
  expect(isEnvBlockNode(block)).toBe(true);
  expect(isRefNode(literal)).toBe(false);
  expect(isEnvBlockNode(literal)).toBe(false);
});

test("a step survives structured cloning unchanged", () => {
  // The protocol's contract: everything crossing the channel is plain JSON.
  const step: EStepperStep = {
    ast: {
      type: "Program",
      nodeId: "0",
      body: [
        {
          type: ENV_BLOCK_NODE_TYPE,
          nodeId: "1",
          envId: "E1",
          body: [{ type: REF_NODE_TYPE, nodeId: "2", objectId: "#2" }],
        },
      ],
    },
    markers: [{ redexId: "1", redexType: "beforeMarker", explanation: "return withdraw" }],
    frames: [
      { id: "Global", name: "global", parentId: null, isGarbage: false, bindings: [] },
      {
        id: "E1",
        name: "make_withdraw",
        parentId: "Global",
        isGarbage: false,
        bindings: [
          { name: "balance", value: { kind: "primitive", display: "100", label: "int" } },
          { name: "withdraw", value: { kind: "ref", objectId: "#2" } },
        ],
      },
    ],
    heap: [
      {
        kind: "function",
        id: "#2",
        name: "withdraw",
        params: ["amount"],
        envId: "E1",
        source: "def withdraw(amount): ...",
        isGarbage: false,
      },
      {
        kind: "list",
        id: "#3",
        elements: [{ kind: "builtin", name: "print" }, { kind: "unassigned" }],
        isGarbage: true,
      },
    ],
    activeFrameId: "E1",
    lookups: [{ frameId: "E1", name: "withdraw" }],
  };
  expect(structuredClone(step)).toEqual(step);
});
