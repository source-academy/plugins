import { expect, test } from "vitest";

import {
  RUNNER_ID,
  STEPPER_CHANNEL_ID,
  type SyntaxProfile,
  type TraceEnd,
} from "@sourceacademy/common-stepper";
import { BaseStepperRunnerPlugin } from "..";

class FakeChannel {
  name = STEPPER_CHANNEL_ID;
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

// A trivial concrete stepper: every "AST" (a number n) becomes n no-op steps.
class CountingStepper extends BaseStepperRunnerPlugin<number> {
  getSteps(ast: number) {
    return Array.from({ length: ast }, (_, i) => ({
      ast: { type: "Literal", nodeId: String(i), value: i },
    }));
  }
}

test("attaches to the stepper channel", () => {
  expect(BaseStepperRunnerPlugin.channelAttach).toEqual([STEPPER_CHANNEL_ID]);
});

test("has the runner id", () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new CountingStepper({} as any, [channel as any]);
  expect(plugin.id).toBe(RUNNER_ID);
});

test("sendSteps computes, caches and pushes steps; request replays them", async () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new CountingStepper({} as any, [channel as any]);
  await plugin.sendSteps(2);
  expect(channel.sent).toEqual([
    {
      type: "steps",
      steps: [
        { ast: { type: "Literal", nodeId: "0", value: 0 } },
        { ast: { type: "Literal", nodeId: "1", value: 1 } },
      ],
    },
  ]);
  channel.emit({ type: "request" });
  expect(channel.sent).toHaveLength(2);
  expect(channel.sent[1]).toEqual(channel.sent[0]);
});

test("sendSteps reports errors instead of throwing", async () => {
  const channel = new FakeChannel();
  class Boom extends BaseStepperRunnerPlugin<number> {
    getSteps(): never {
      throw new Error("kaboom");
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new Boom({} as any, [channel as any]);
  await plugin.sendSteps(1);
  expect(channel.sent).toEqual([{ type: "error", error: "kaboom" }]);
});

// A stepper that streams: the AST (a number n) gives n steps in batches of 2, then ends as `ending`
// says (a generator that returns nothing ended its trace completely).
const step = (i: number) => ({ ast: { type: "Literal", nodeId: String(i), value: i } });

class StreamingStepper extends BaseStepperRunnerPlugin<number> {
  ending: TraceEnd | void = undefined;
  failAfter: number | undefined = undefined;

  getSteps(ast: number) {
    return Array.from({ length: ast }, (_, i) => step(i));
  }

  protected override getStepBatches(ast: number) {
    const { failAfter, ending } = this;
    return (function* () {
      for (let i = 0; i < ast; i += 2) {
        if (failAfter !== undefined && i >= failAfter) throw new Error("boom");
        yield Array.from({ length: Math.min(2, ast - i) }, (_, k) => step(i + k));
      }
      return ending;
    })();
  }
}

function streaming() {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = new StreamingStepper({} as any, [channel as any]);
  return { channel, plugin };
}

test("a language that streams has its steps sent in batches, then the end", async () => {
  const { channel, plugin } = streaming();
  await plugin.sendSteps(3);
  expect(channel.sent).toEqual([
    { type: "batch", index: 0, steps: [step(0), step(1)] },
    { type: "batch", index: 2, steps: [step(2)] },
    { type: "batch", index: 3, steps: [], end: { status: "complete" } },
  ]);
});

test("the end that the generator returns is the end of the trace", async () => {
  const { channel, plugin } = streaming();
  plugin.ending = { status: "cut-off", reason: "too long" };
  await plugin.sendSteps(2);
  expect(channel.sent.at(-1)).toEqual({
    type: "batch",
    index: 2,
    steps: [],
    end: { status: "cut-off", reason: "too long" },
  });
});

test("a streamed run with no steps still starts the run, and ends it", async () => {
  const { channel, plugin } = streaming();
  await plugin.sendSteps(0);
  expect(channel.sent).toEqual([
    { type: "batch", index: 0, steps: [], end: { status: "complete" } },
  ]);
});

test("a failure after some batches keeps them and ends the trace as cut off", async () => {
  const { channel, plugin } = streaming();
  plugin.failAfter = 2;
  await plugin.sendSteps(6);
  expect(channel.sent).toEqual([
    { type: "batch", index: 0, steps: [step(0), step(1)] },
    { type: "batch", index: 2, steps: [], end: { status: "cut-off", reason: "boom" } },
  ]);
});

test("a failure before any batch is reported as an error", async () => {
  const { channel, plugin } = streaming();
  plugin.failAfter = 0;
  await plugin.sendSteps(4);
  expect(channel.sent).toEqual([{ type: "error", error: "boom" }]);
});

test("request replays a streamed run as one batch that carries its end", async () => {
  const { channel, plugin } = streaming();
  await plugin.sendSteps(3);
  channel.sent.length = 0;
  channel.emit({ type: "request" });
  expect(channel.sent).toEqual([
    {
      type: "batch",
      index: 0,
      steps: [step(0), step(1), step(2)],
      profile: undefined,
      end: { status: "complete" },
    },
  ]);
});

test("a new run replaces the replay of the one before", async () => {
  const { channel, plugin } = streaming();
  await plugin.sendSteps(4);
  await plugin.sendSteps(1);
  channel.sent.length = 0;
  channel.emit({ type: "request" });
  expect(channel.sent).toEqual([
    {
      type: "batch",
      index: 0,
      steps: [step(0)],
      profile: undefined,
      end: { status: "complete" },
    },
  ]);
});

test("an async generator of batches is streamed the same way", async () => {
  const channel = new FakeChannel();
  class AsyncStreaming extends BaseStepperRunnerPlugin<number> {
    getSteps() {
      return [];
    }
    protected override getStepBatches(n: number) {
      return (async function* () {
        await Promise.resolve();
        yield [step(n)];
      })();
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await new AsyncStreaming({} as any, [channel as any]).sendSteps(7);
  expect(channel.sent).toEqual([
    { type: "batch", index: 0, steps: [step(7)] },
    { type: "batch", index: 1, steps: [], end: { status: "complete" } },
  ]);
});

test("a language that does not stream still sends one steps message", async () => {
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await new CountingStepper({} as any, [channel as any]).sendSteps(1);
  expect(channel.sent).toEqual([{ type: "steps", steps: [step(0)] }]);
});

test("the profile goes with the first batch only", async () => {
  const profile = { language: "x" } as unknown as SyntaxProfile;
  class Profiled extends StreamingStepper {
    protected override getSyntaxProfile() {
      return profile;
    }
  }
  const channel = new FakeChannel();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await new Profiled({} as any, [channel as any]).sendSteps(4);
  expect(channel.sent.map(m => (m as { profile?: unknown }).profile)).toEqual([
    profile,
    undefined,
    undefined,
  ]);
});
