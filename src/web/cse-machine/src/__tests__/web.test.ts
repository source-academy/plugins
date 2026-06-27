import { test, expect, vi } from "vitest";
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

const makePlugin = (channel: IChannel<unknown>, onReceive?: (s: CseSnapshot[]) => void) => {
  const receive = onReceive ?? vi.fn();
  class TestPlugin extends CseMachineHostPlugin {
    receiveSnapshots = receive;
  }
  return { plugin: new TestPlugin({} as IConduit, [channel]), receive };
};

const snapshot: CseSnapshot = {
  stepIndex: 0,
  control: [],
  stash: [],
  environments: [{ id: "g", name: "global", parentId: null, bindings: [], isActive: true }],
};

test("attaches to the cse channel and uses the web id", () => {
  expect(CseMachineHostPlugin.channelAttach).toEqual([CSE_CHANNEL]);
});

test("id is WEB_ID", () => {
  const channel = makeChannel();
  const { plugin } = makePlugin(channel);
  expect(plugin.id).toBe(WEB_ID);
});

test("receiveSnapshots is called when a valid snapshots message arrives", () => {
  const channel = makeChannel();
  const receive = vi.fn();
  makePlugin(channel, receive);

  channel.emit({ type: CSE_MESSAGE_TYPE_SNAPSHOTS, snapshots: [snapshot], totalSteps: 1 });

  expect(receive).toHaveBeenCalledOnce();
  expect(receive).toHaveBeenCalledWith([snapshot]);
});

test("invalid messages are silently ignored", () => {
  const channel = makeChannel();
  const receive = vi.fn();
  makePlugin(channel, receive);

  channel.emit({ type: "unknown", snapshots: [snapshot] });
  channel.emit(null);
  channel.emit({ type: CSE_MESSAGE_TYPE_SNAPSHOTS, snapshots: "bad" });

  expect(receive).not.toHaveBeenCalled();
});

test("constructor throws when cseChannel is not provided", () => {
  class TestPlugin extends CseMachineHostPlugin {
    receiveSnapshots = vi.fn();
  }
  expect(() => new TestPlugin({} as IConduit, [])).toThrow(
    "CSE channel is required but was not provided.",
  );
});
