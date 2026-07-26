import { expect, test } from "vitest";

import {
  DATA_VISUALIZER_CHANNEL_ID,
  RUNNER_ID,
  type SerializedDataVisualizerNode,
} from "@sourceacademy/common-data-visualizer";
import { BaseDataVisualizerRunnerPlugin, createRefIdAllocator, type RefIdAllocator } from "..";

class FakeChannel {
  name = DATA_VISUALIZER_CHANNEL_ID;
  sent: unknown[] = [];
  private subscribers: ((m: unknown) => void)[] = [];
  send(message: unknown) {
    this.sent.push(message);
  }
  subscribe(fn: (m: unknown) => void) {
    this.subscribers.push(fn);
  }
  unsubscribe(fn: (m: unknown) => void) {
    this.subscribers = this.subscribers.filter(s => s !== fn);
  }
  close() {}
  emit(message: unknown) {
    this.subscribers.forEach(fn => fn(message));
  }
}

// A trivial concrete adapter: a "value" is either a number (leaf) or an array of values (compound).
// Purely mechanical, like a real language adapter must be — no cycle-detection or classification.
type TestValue = number | TestValue[];

class ArrayDataVisualizer extends BaseDataVisualizerRunnerPlugin<TestValue> {
  protected toNode(value: TestValue, refs: RefIdAllocator): SerializedDataVisualizerNode {
    if (!Array.isArray(value)) {
      return { type: "leaf", displayValue: String(value), label: "number" };
    }
    const { refId, alreadySeen } = refs.get(value);
    if (alreadySeen) {
      return { type: "ref", refId };
    }
    return { type: "array", refId, children: value.map(v => this.toNode(v, refs)) };
  }
}

test("attaches to the data visualizer channel", () => {
  expect(BaseDataVisualizerRunnerPlugin.channelAttach).toEqual([DATA_VISUALIZER_CHANNEL_ID]);
});

test("has the runner id", () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new ArrayDataVisualizer({} as any, [channel as any]);
  expect(plugin.id).toBe(RUNNER_ID);
});

test("sendDrawing serializes one row and pushes the full row list", async () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new ArrayDataVisualizer({} as any, [channel as any]);
  await plugin.sendDrawing([1, [2, 3]]);
  expect(channel.sent).toEqual([
    {
      type: "rows",
      rows: [
        [
          { type: "leaf", displayValue: "1", label: "number" },
          { type: "array", refId: 1, children: [
            { type: "leaf", displayValue: "2", label: "number" },
            { type: "leaf", displayValue: "3", label: "number" },
          ] },
        ],
      ],
    },
  ]);
});

test("multiple sendDrawing calls accumulate rows, resending the full list each time", async () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new ArrayDataVisualizer({} as any, [channel as any]);
  await plugin.sendDrawing([1]);
  await plugin.sendDrawing([2]);
  expect(channel.sent).toHaveLength(2);
  expect(channel.sent[1]).toEqual({
    type: "rows",
    rows: [
      [{ type: "leaf", displayValue: "1", label: "number" }],
      [{ type: "leaf", displayValue: "2", label: "number" }],
    ],
  });
});

test("request replays the rows accumulated so far", async () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new ArrayDataVisualizer({} as any, [channel as any]);
  await plugin.sendDrawing([1]);
  channel.emit({ type: "request" });
  expect(channel.sent).toHaveLength(2);
  expect(channel.sent[1]).toEqual(channel.sent[0]);
});

test("resetRun clears accumulated rows and pushes the empty state", async () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new ArrayDataVisualizer({} as any, [channel as any]);
  await plugin.sendDrawing([1]);
  await plugin.resetRun();
  expect(channel.sent[1]).toEqual({ type: "rows", rows: [] });

  channel.emit({ type: "request" });
  expect(channel.sent[2]).toEqual({ type: "rows", rows: [] });
});

test("a self-referential value terminates via a ref node instead of recursing forever", async () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new ArrayDataVisualizer({} as any, [channel as any]);
  const cyclic: TestValue[] = [1];
  cyclic.push(cyclic);

  await plugin.sendDrawing([cyclic]);

  const message = channel.sent[0] as { rows: SerializedDataVisualizerNode[][] };
  const [node] = message.rows[0];
  expect(node).toEqual({
    type: "array",
    refId: 1,
    children: [
      { type: "leaf", displayValue: "1", label: "number" },
      { type: "ref", refId: 1 },
    ],
  });
});

test("createRefIdAllocator assigns the same id to the same reference and different ids otherwise", () => {
  const refs = createRefIdAllocator();
  const a = {};
  const b = {};
  const first = refs.get(a);
  const second = refs.get(a);
  const third = refs.get(b);
  expect(first).toEqual({ refId: first.refId, alreadySeen: false });
  expect(second).toEqual({ refId: first.refId, alreadySeen: true });
  expect(third.refId).not.toBe(first.refId);
  expect(third.alreadySeen).toBe(false);
});
