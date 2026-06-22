import { vi, test, expect } from "vitest";

vi.mock("py-slang/src/engines/ev3/EV3Engine", () => ({
  EV3Engine: class MockEV3Engine {
    async execute(code: string) {
      return { output: `mock: ${code}` };
    }
  },
}));

import { remoteRunnerPlugin } from "@sourceacademy/runner-remote-execution";
import type { PySlangMessage } from "@sourceacademy/common-test";

test("plugin subscribes to channel and sends result on run message", async () => {
  const sentMessages: PySlangMessage[] = [];
  let messageHandler: (msg: PySlangMessage) => void = () => {};

  const mockChannel = {
    name: "py_slang_channel",
    send: (msg: PySlangMessage) => {
      sentMessages.push(msg);
    },
    subscribe: (handler: (msg: PySlangMessage) => void) => {
      messageHandler = handler;
    },
    unsubscribe: () => {},
    close: () => {},
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockConduit = {} as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  new remoteRunnerPlugin(mockConduit, [mockChannel as any]);

  await messageHandler({ type: "run", code: "1 + 1" });

  expect(sentMessages.length).toBeGreaterThan(0);
  expect(sentMessages[0]).toMatchObject({ type: "result" });
});
