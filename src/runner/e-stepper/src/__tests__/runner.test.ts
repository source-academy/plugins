import { expect, test } from "vitest";

import {
  E_STEPPER_CHANNEL_ID,
  RUNNER_ID,
  type EStepperStep,
} from "@sourceacademy/common-e-stepper";
import { STEPPER_CHANNEL_ID } from "@sourceacademy/common-stepper";
import { BaseStepperRunnerPlugin } from "@sourceacademy/runner-stepper";
import { BaseEStepperRunnerPlugin } from "..";

class FakeChannel {
  name = E_STEPPER_CHANNEL_ID;
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

const step = (i: number): EStepperStep => ({
  ast: { type: "Literal", nodeId: String(i), value: i },
  frames: [{ id: "Global", name: "global", parentId: null, bindings: [], isGarbage: false }],
  heap: [],
  activeFrameId: "Global",
});

// A trivial concrete e-stepper: every "AST" (a number n) becomes n steps.
class CountingEStepper extends BaseEStepperRunnerPlugin<number> {
  getSteps(ast: number) {
    return Array.from({ length: ast }, (_, i) => step(i));
  }
}

const make = <T>(Cls: new (...args: never[]) => T, channel: FakeChannel): T =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new (Cls as any)({} as any, [channel as any]);

test("attaches to the e-stepper channel, not the stepper's", () => {
  expect(BaseEStepperRunnerPlugin.channelAttach).toEqual([E_STEPPER_CHANNEL_ID]);
  // Overriding the static must not change the stepper's own.
  expect(BaseStepperRunnerPlugin.channelAttach).toEqual([STEPPER_CHANNEL_ID]);
});

test("has the e-stepper runner id", () => {
  expect(make(CountingEStepper, new FakeChannel()).id).toBe(RUNNER_ID);
});

test("sendSteps computes, caches and pushes steps; request replays them", async () => {
  const channel = new FakeChannel();
  const plugin = make(CountingEStepper, channel);
  await plugin.sendSteps(2);
  expect(channel.sent).toEqual([{ type: "steps", steps: [step(0), step(1)] }]);
  channel.emit({ type: "request" });
  expect(channel.sent).toHaveLength(2);
  expect(channel.sent[1]).toEqual(channel.sent[0]);
});

test("ships the language's syntax profile with the steps", async () => {
  const channel = new FakeChannel();
  class WithProfile extends CountingEStepper {
    protected override getSyntaxProfile() {
      return { templates: { Literal: [{ prop: "value" }] } };
    }
  }
  await make(WithProfile, channel).sendSteps(1);
  expect(channel.sent).toEqual([
    { type: "steps", steps: [step(0)], profile: { templates: { Literal: [{ prop: "value" }] } } },
  ]);
});

test("sendSteps reports errors instead of throwing", async () => {
  const channel = new FakeChannel();
  class Boom extends BaseEStepperRunnerPlugin<number> {
    getSteps(): never {
      throw new Error("kaboom");
    }
  }
  await make(Boom, channel).sendSteps(1);
  expect(channel.sent).toEqual([{ type: "error", error: "kaboom" }]);
});
