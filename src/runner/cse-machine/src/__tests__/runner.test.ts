import { describe, test, expect, vi } from "vitest";
import { CseMachinePlugin } from "..";
import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  RUNNER_ID,
  type CseSnapshot,
} from "@sourceacademy/common-cse-machine";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const makeChannel = () => {
  const send = vi.fn();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { send } as unknown as IChannel<any> & { send: typeof send };
};
const makePlugin = (ch = makeChannel()) => new CseMachinePlugin({} as IConduit, [ch]);

const minimalSnapshot = (): CseSnapshot => ({
  stepIndex: 0,
  control: [],
  stash: [],
  environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
});

// ── Identity / wiring ─────────────────────────────────────────────────────────

describe("plugin identity", () => {
  test("id is RUNNER_ID", () => {
    expect(makePlugin().id).toBe(RUNNER_ID);
  });

  test("channelAttach declares the CSE channel", () => {
    expect(CseMachinePlugin.channelAttach).toEqual([CSE_CHANNEL]);
  });

  test("channelAttach contains exactly one channel", () => {
    expect(CseMachinePlugin.channelAttach).toHaveLength(1);
  });
});

// ── Constructor ───────────────────────────────────────────────────────────────

describe("constructor", () => {
  test("throws when no channel is provided", () => {
    expect(() => new CseMachinePlugin({} as IConduit, [])).toThrow(
      "CSE channel is required but was not provided.",
    );
  });

  test("does not throw when a channel is provided", () => {
    expect(() => makePlugin()).not.toThrow();
  });
});

// ── sendSnapshots ─────────────────────────────────────────────────────────────

describe("sendSnapshots", () => {
  test("sends a message with the correct type discriminator", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    plugin.sendSnapshots([minimalSnapshot()]);
    expect(channel.send.mock.calls[0][0].type).toBe(CSE_MESSAGE_TYPE_SNAPSHOTS);
  });

  test("sends snapshots unchanged", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    const snapshots = [minimalSnapshot()];
    plugin.sendSnapshots(snapshots);
    expect(channel.send.mock.calls[0][0].snapshots).toEqual(snapshots);
  });

  test("sets totalSteps to the length of the snapshots array", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    const snapshots = [minimalSnapshot(), { ...minimalSnapshot(), stepIndex: 1 }];
    plugin.sendSnapshots(snapshots);
    expect(channel.send.mock.calls[0][0].totalSteps).toBe(2);
  });

  test("calls channel.send exactly once per sendSnapshots call", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    plugin.sendSnapshots([minimalSnapshot()]);
    expect(channel.send).toHaveBeenCalledTimes(1);
  });

  test("can be called multiple times, sending once each time", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    plugin.sendSnapshots([minimalSnapshot()]);
    plugin.sendSnapshots([minimalSnapshot()]);
    expect(channel.send).toHaveBeenCalledTimes(2);
  });

  test("handles an empty snapshots array", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    plugin.sendSnapshots([]);
    expect(channel.send.mock.calls[0][0]).toEqual({
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots: [],
      totalSteps: 0,
    });
  });

  test("handles a large batch of snapshots", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    const snapshots = Array.from({ length: 50 }, (_, i) => ({
      ...minimalSnapshot(),
      stepIndex: i,
    }));
    plugin.sendSnapshots(snapshots);
    expect(channel.send.mock.calls[0][0].totalSteps).toBe(50);
  });

  test("preserves snapshot fields including currentLine and metadata", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    const snap: CseSnapshot = {
      stepIndex: 3,
      control: [{ displayText: "call f", metadata: { instrType: "Application" } }],
      stash: [{ displayValue: "42", label: "number" }],
      environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
      currentLine: 7,
    };
    plugin.sendSnapshots([snap]);
    expect(channel.send.mock.calls[0][0].snapshots[0]).toEqual(snap);
  });
});
