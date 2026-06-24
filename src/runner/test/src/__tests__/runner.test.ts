import { remoteRunnerPlugin } from "@sourceacademy/runner-remote-execution";
import type { PySlangMessage } from "@sourceacademy/common-test";
import { IConduit, IChannel } from "@sourceacademy/conductor/conduit";

class TestRemoteRunnerPlugin extends remoteRunnerPlugin {
  constructor(conduit: IConduit, channels: IChannel<any>[]) {
    super(conduit, channels);
  }
}

test("compiles and processes python code via EV3Engine", async () => {
  const sentMessages: PySlangMessage[] = [];
  let messageHandler: (msg: PySlangMessage) => void = () => {};

  const mockChannel = {
    name: "py_slang_channel",
    send: (msg: PySlangMessage) => { sentMessages.push(msg); },
    subscribe: (handler: (msg: PySlangMessage) => void) => { messageHandler = handler; },
    unsubscribe: () => {},
    close: () => {},
  };

  const mockConduit = {} as any;

  new TestRemoteRunnerPlugin(mockConduit, [mockChannel as any]);

  await messageHandler({ type: "run", code: "1 + 1" });

  expect(sentMessages.length).toBeGreaterThan(0);
  expect(sentMessages[0].type).toBe("result");
});