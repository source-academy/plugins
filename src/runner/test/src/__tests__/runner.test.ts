import { remoteRunnerPlugin } from "@sourceacademy/runner-remote-execution";
import type { PySlangMessage } from "@sourceacademy/common-test";

test("compiles and processes python code via EV3Engine", async () => {
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

  const mockConduit = {} as any;
});
