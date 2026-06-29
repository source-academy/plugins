import { describe, test, expect, vi } from "vitest";
import { CseMachineHostPlugin } from "..";
import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  WEB_ID,
  type CseSnapshot,
} from "@sourceacademy/common-cse-machine";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";

const makeChannel = () => {
  let subscriber: ((msg: unknown) => void) | undefined;
  const channel = {
    subscribe: (fn: (msg: unknown) => void) => {
      subscriber = fn;
    },
    emit: (msg: unknown) => subscriber?.(msg),
  };
  return channel as unknown as IChannel<unknown> & { emit: (msg: unknown) => void };
};

const makePlugin = (channel: ReturnType<typeof makeChannel>, onReceive = vi.fn()) => {
  class TestPlugin extends CseMachineHostPlugin {
    receiveSnapshots = onReceive;
  }
  const plugin = new TestPlugin({} as IConduit, [channel]);
  return { plugin, receive: onReceive };
};

const snapshot = (): CseSnapshot => ({
  stepIndex: 0,
  control: [],
  stash: [],
  environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
});

const validMessage = (snapshots: CseSnapshot[] = [snapshot()]) => ({
  type: CSE_MESSAGE_TYPE_SNAPSHOTS,
  snapshots,
  totalSteps: snapshots.length,
});

// ── Identity / wiring ─────────────────────────────────────────────────────────

describe("plugin identity", () => {
  test("id is WEB_ID", () => {
    const channel = makeChannel();
    const { plugin } = makePlugin(channel);
    expect(plugin.id).toBe(WEB_ID);
  });

  test("channelAttach declares the CSE channel", () => {
    expect(CseMachineHostPlugin.channelAttach).toEqual([CSE_CHANNEL]);
  });

  test("channelAttach contains exactly one channel", () => {
    expect(CseMachineHostPlugin.channelAttach).toHaveLength(1);
  });
});

// ── Constructor ───────────────────────────────────────────────────────────────

describe("constructor", () => {
  test("throws when no channel is provided", () => {
    class TestPlugin extends CseMachineHostPlugin {
      receiveSnapshots = vi.fn();
    }
    expect(() => new TestPlugin({} as IConduit, [])).toThrow(
      "CSE channel is required but was not provided.",
    );
  });

  test("does not throw when a channel is provided", () => {
    expect(() => makePlugin(makeChannel())).not.toThrow();
  });
});

// ── Valid messages ────────────────────────────────────────────────────────────

describe("valid messages", () => {
  test("receiveSnapshots is called with the snapshot array", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit(validMessage());
    expect(receive).toHaveBeenCalledOnce();
    expect(receive).toHaveBeenCalledWith([snapshot()]);
  });

  test("receiveSnapshots receives multiple snapshots in order", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    const snaps = [snapshot(), { ...snapshot(), stepIndex: 1 }, { ...snapshot(), stepIndex: 2 }];
    channel.emit(validMessage(snaps));
    expect(receive).toHaveBeenCalledWith(snaps);
  });

  test("receiveSnapshots is called once per valid message", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit(validMessage());
    channel.emit(validMessage());
    expect(receive).toHaveBeenCalledTimes(2);
  });

  test("handles an empty snapshots array", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit(validMessage([]));
    expect(receive).toHaveBeenCalledWith([]);
  });

  test("preserves snapshot fields passed through the channel", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    const snap: CseSnapshot = {
      stepIndex: 4,
      control: [{ displayText: "branch", metadata: { instrType: "Branch" } }],
      stash: [{ displayValue: "false", label: "bool" }],
      environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
      currentLine: 9,
    };
    channel.emit(validMessage([snap]));
    expect(receive).toHaveBeenCalledWith([snap]);
  });
});

// ── Invalid / malformed messages ──────────────────────────────────────────────

describe("invalid messages", () => {
  test("unknown message type is silently ignored", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit({ type: "unknown", snapshots: [snapshot()], totalSteps: 1 });
    expect(receive).not.toHaveBeenCalled();
  });

  test("null message is silently ignored", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit(null);
    expect(receive).not.toHaveBeenCalled();
  });

  test("undefined message is silently ignored", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit(undefined);
    expect(receive).not.toHaveBeenCalled();
  });

  test("snapshots field is not an array — ignored", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit({ type: CSE_MESSAGE_TYPE_SNAPSHOTS, snapshots: "bad", totalSteps: 1 });
    expect(receive).not.toHaveBeenCalled();
  });

  test("totalSteps mismatch — ignored", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit({ type: CSE_MESSAGE_TYPE_SNAPSHOTS, snapshots: [snapshot()], totalSteps: 99 });
    expect(receive).not.toHaveBeenCalled();
  });

  test("missing snapshots field — ignored", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit({ type: CSE_MESSAGE_TYPE_SNAPSHOTS, totalSteps: 0 });
    expect(receive).not.toHaveBeenCalled();
  });

  test("empty object — ignored", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit({});
    expect(receive).not.toHaveBeenCalled();
  });

  test("invalid messages do not block subsequent valid ones", () => {
    const channel = makeChannel();
    const { receive } = makePlugin(channel);
    channel.emit(null);
    channel.emit({ type: "bad" });
    channel.emit(validMessage());
    expect(receive).toHaveBeenCalledOnce();
  });
});

// ── Re-exports ────────────────────────────────────────────────────────────────

describe("re-exports from common", () => {
  test("CseSnapshot type is re-exported and usable", () => {
    // If the import at the top of this file resolves, the re-export works.
    // This test documents the contract rather than testing runtime behaviour.
    const snap: CseSnapshot = snapshot();
    expect(snap).toBeDefined();
  });
});
