import { expect, test } from "vitest";

import { RUNNER_ID, STEPPER_CHANNEL_ID } from "@sourceacademy/common-stepper";
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
