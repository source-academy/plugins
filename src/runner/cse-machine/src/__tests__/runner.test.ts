import { describe, test, expect, vi } from "vitest";
import { CseMachinePlugin } from "..";
import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  RUNNER_ID,
  type CseSnapshot,
} from "@sourceacademy/common-cse-machine";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";

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
      breakpointSteps: [],
    });
  });

  test("defaults breakpointSteps to an empty array when omitted", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    plugin.sendSnapshots([minimalSnapshot()]);
    expect(channel.send.mock.calls[0][0].breakpointSteps).toEqual([]);
  });

  test("forwards the breakpointSteps argument unchanged", () => {
    const channel = makeChannel();
    const plugin = makePlugin(channel);
    const snapshots = [minimalSnapshot(), { ...minimalSnapshot(), stepIndex: 1 }];
    plugin.sendSnapshots(snapshots, [1]);
    expect(channel.send.mock.calls[0][0].breakpointSteps).toEqual([1]);
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

// ── Batches ───────────────────────────────────────────────────────────────────

describe("sendBatch / endRun", () => {
  const at = (stepIndex: number): CseSnapshot => ({ ...minimalSnapshot(), stepIndex });

  test("each batch continues the run, with the index of its first snapshot", () => {
    const ch = makeChannel();
    const plugin = makePlugin(ch);
    plugin.sendBatch([at(0), at(1)]);
    plugin.sendBatch([at(2)], [2]);
    expect(ch.send).toHaveBeenNthCalledWith(1, {
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: 0,
      snapshots: [at(0), at(1)],
      breakpointSteps: [],
    });
    expect(ch.send).toHaveBeenNthCalledWith(2, {
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: 2,
      snapshots: [at(2)],
      breakpointSteps: [2],
    });
  });

  test("sends nothing for no snapshots", () => {
    const ch = makeChannel();
    makePlugin(ch).sendBatch([]);
    expect(ch.send).not.toHaveBeenCalled();
  });

  test("endRun sends a last empty batch that says the run completed", () => {
    const ch = makeChannel();
    const plugin = makePlugin(ch);
    plugin.sendBatch([at(0)]);
    plugin.endRun();
    expect(ch.send).toHaveBeenLastCalledWith({
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: 1,
      snapshots: [],
      end: { status: "complete" },
    });
  });

  test("endRun can say that the run was cut off, and why", () => {
    const ch = makeChannel();
    const plugin = makePlugin(ch);
    plugin.sendBatch([at(0)]);
    plugin.endRun({ status: "cut-off", reason: "too many steps" });
    expect(ch.send).toHaveBeenLastCalledWith(
      expect.objectContaining({ end: { status: "cut-off", reason: "too many steps" } }),
    );
  });

  test("the next batch after endRun starts a new run", () => {
    const ch = makeChannel();
    const plugin = makePlugin(ch);
    plugin.sendBatch([at(0), at(1)]);
    plugin.endRun();
    plugin.sendBatch([at(0)]);
    expect(ch.send).toHaveBeenLastCalledWith(expect.objectContaining({ index: 0 }));
  });

  test("a run with no snapshots at all can still be ended", () => {
    const ch = makeChannel();
    makePlugin(ch).endRun();
    expect(ch.send).toHaveBeenCalledWith({
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: 0,
      snapshots: [],
      end: { status: "complete" },
    });
  });

  test("sendSnapshots (a whole run) starts the count again", () => {
    const ch = makeChannel();
    const plugin = makePlugin(ch);
    plugin.sendBatch([at(0), at(1)]);
    plugin.sendSnapshots([at(0)]);
    plugin.sendBatch([at(0)]);
    expect(ch.send).toHaveBeenLastCalledWith(expect.objectContaining({ index: 0 }));
  });
});
