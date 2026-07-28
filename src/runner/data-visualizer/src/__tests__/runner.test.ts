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

test("a value shared across two arguments of one call is fully re-serialized in each, not collapsed to an unresolvable ref", async () => {
  // The host renders each argument of a draw_data(...) call as its own independent Konva Stage
  // (a separate <canvas>), so a "ref" node can only ever be resolved against other nodes already
  // built within that SAME argument's tree — there is no way to draw, or even resolve, an arrow
  // pointing into a different argument's canvas. sendDrawing must therefore give each argument its
  // own fresh RefIdAllocator, so a value shared *across* arguments is serialized in full both times
  // (matching the old pre-Conductor frontend's per-argument `visitedStructures` scoping) rather than
  // silently collapsing the second occurrence into a ref the host can never resolve.
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new ArrayDataVisualizer({} as any, [channel as any]);
  const shared: TestValue[] = [1];

  await plugin.sendDrawing([shared, [shared, 2]]);

  const message = channel.sent[0] as { rows: SerializedDataVisualizerNode[][] };
  const [firstArg, secondArg] = message.rows[0];
  // First argument's own allocator sees `shared` first, so it claims refId 1.
  expect(firstArg).toEqual({
    type: "array",
    refId: 1,
    children: [{ type: "leaf", displayValue: "1", label: "number" }],
  });
  // Second argument gets its own fresh allocator: its outer wrapper array (a distinct object from
  // `shared`) is visited first and claims refId 1 for *this* argument; `shared` is then a new value
  // as far as this allocator is concerned, and claims refId 2 — fully expanded, not a "ref".
  expect(secondArg).toEqual({
    type: "array",
    refId: 1,
    children: [
      {
        type: "array",
        refId: 2,
        children: [{ type: "leaf", displayValue: "1", label: "number" }],
      },
      { type: "leaf", displayValue: "2", label: "number" },
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
