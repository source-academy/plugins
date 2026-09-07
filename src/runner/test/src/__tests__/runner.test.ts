import { vi, test, expect } from "vitest";
import { RemoteExecutionPlugin } from "@sourceacademy/runner-remote-execution";
import type { ConnectionStatusMessage } from "@sourceacademy/common-remote-execution";

test("plugin forwards connection status over its channel without touching execution", () => {
  const sentMessages: ConnectionStatusMessage[] = [];

  const mockChannel = {
    name: "remote-execution",
    send: (msg: ConnectionStatusMessage) => {
      sentMessages.push(msg);
    },
    subscribe: vi.fn(),
    unsubscribe: vi.fn(),
    close: vi.fn(),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockConduit = {} as any;
  const plugin = new RemoteExecutionPlugin(mockConduit, [mockChannel]);

  plugin.sendConnectionStatus("CONNECTED");

  expect(sentMessages).toStrictEqual([{ type: "connectionStatus", status: "CONNECTED" }]);
});

test("plugin construction throws if no channel is attached", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockConduit = {} as any;

  expect(() => new RemoteExecutionPlugin(mockConduit, [])).toThrow();
});
