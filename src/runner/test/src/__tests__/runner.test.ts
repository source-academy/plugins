import type { PySlangMessage } from '@sourceacademy/common-test';
import { remoteRunnerPlugin } from '@sourceacademy/runner-remote-execution';
import { expect, test, vi } from 'vitest';

vi.mock(
  import('py-slang/src/engines/ev3/EV3Engine'),
  () =>
    ({
      EV3Engine: class MockEV3Engine {
        execute(code: string) {
          return Promise.resolve({ output: `mock: ${code}` });
        }
      },
    }) as any,
);

test('plugin subscribes to channel and sends result on run message', async () => {
  const sentMessages: PySlangMessage[] = [];
  let messageHandler: (msg: PySlangMessage) => void = () => {};

  const mockChannel = {
    name: 'py_slang_channel',
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
  new remoteRunnerPlugin(mockConduit, [mockChannel as any]);

  await messageHandler({ type: 'run', code: '1 + 1' });

  expect(sentMessages.length).toBeGreaterThan(0);
  expect(sentMessages[0]).toMatchObject({ type: 'result' });
});
