import {
  AUTOCOMPLETE_CHANNEL_ID,
  RUNNER_PLUGIN_ID,
  SYNTAX_CHANNEL_ID,
  type AutoCompleteEntry,
  type AutoCompleteMessage,
  type ModeRpc,
  type SyntaxHighlightData,
  type SyntaxHighlightMessage,
  type TransferredSyntaxHighlightData,
} from '@sourceacademy/common-autocomplete';
import {
  makeRpc,
  type IChannel,
  type IConduit,
  type IRpcMessage,
} from '@sourceacademy/conductor/conduit';
import { afterEach, expect, test, vi } from 'vitest';
import { BaseAutoCompleteRunnerPlugin } from '..';

afterEach(() => {
  vi.useRealTimers();
});

test('should have a valid channel id', () => {
  expect(BaseAutoCompleteRunnerPlugin.channelAttach).toEqual([
    AUTOCOMPLETE_CHANNEL_ID,
    SYNTAX_CHANNEL_ID,
  ]);
});

class TestRunner extends BaseAutoCompleteRunnerPlugin {
  autocompleteCalls: [string, number, number][] = [];

  get mode(): SyntaxHighlightData {
    return {
      highlightRules: {},
      foldingRules: { hookFrom: 'ace/mode/folding/cstyle', args: [] },
      lineCommentStart: '//',
      pairQuotesAfter: {},
      indents: (value: string) => `indented:${value}`,
      outdents: { hookFrom: 'ace/mode/text' },
      autoOutdent: (value: string) => `outdented:${value}`,
      id: 'rpc-test',
    };
  }

  autocomplete(code: string, row: number, column: number): AutoCompleteEntry[] {
    this.autocompleteCalls.push([code, row, column]);
    return [{ name: 'result', meta: 'var' as AutoCompleteEntry['meta'] }];
  }
}

class FunctionOutdentsRunner extends TestRunner {
  override get mode(): SyntaxHighlightData {
    return {
      ...super.mode,
      outdents: (value: string) => `should-outdent:${value}`,
    };
  }
}

class TestChannel<T> implements IChannel<T> {
  readonly name = 'test';
  private readonly subscribers = new Set<(message: T) => void>();
  peer?: TestChannel<T>;

  send(message: T): void {
    this.peer?.emit(message);
  }

  subscribe(subscriber: (message: T) => void): void {
    this.subscribers.add(subscriber);
  }

  unsubscribe(subscriber: (message: T) => void): void {
    this.subscribers.delete(subscriber);
  }

  close(): void {
    this.subscribers.clear();
  }

  private emit(message: T): void {
    for (const subscriber of this.subscribers) {
      subscriber(message);
    }
  }
}

const makeChannelPair = (): [TestChannel<unknown>, TestChannel<unknown>] => {
  const runner = new TestChannel<unknown>();
  const web = new TestChannel<unknown>();
  runner.peer = web;
  web.peer = runner;
  return [runner, web];
};

test('exposes the runner plugin identity', () => {
  const [runnerAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  const plugin = new TestRunner(
    {} as IConduit,
    [runnerAutocomplete, runnerSyntax] as IChannel<unknown>[],
  );
  webSyntax.send({ type: 'ack' });

  expect(plugin.id).toBe(RUNNER_PLUGIN_ID);
});

test('responds to autocomplete requests over its Conductor channel', () => {
  const [runnerAutocomplete, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  const plugin = new TestRunner(
    {} as IConduit,
    [runnerAutocomplete, runnerSyntax] as IChannel<unknown>[],
  );
  webSyntax.send({ type: 'ack' });

  let response: AutoCompleteMessage | undefined;
  webAutocomplete.subscribe(message => {
    if ((message as AutoCompleteMessage).type === 'response') {
      response = message as AutoCompleteMessage;
    }
  });
  webAutocomplete.send({
    type: 'request',
    requestId: 17,
    code: 'res',
    row: 2,
    column: 3,
  });
  webAutocomplete.send({
    type: 'response',
    requestId: 99,
    declarations: [],
  });

  expect(plugin.autocompleteCalls).toEqual([['res', 2, 3]]);
  expect(response).toEqual({
    type: 'response',
    requestId: 17,
    declarations: [{ name: 'result', meta: 'var' }],
  });
});

test('retries syntax transfer until the web plugin acknowledges it', () => {
  vi.useFakeTimers();
  const [runnerAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  new TestRunner({} as IConduit, [runnerAutocomplete, runnerSyntax] as IChannel<unknown>[]);

  const responses: SyntaxHighlightMessage[] = [];
  webSyntax.subscribe(message => {
    if ((message as SyntaxHighlightMessage).type === 'response') {
      responses.push(message as SyntaxHighlightMessage);
    }
  });

  vi.advanceTimersByTime(3000);
  expect(responses).toHaveLength(3);

  webSyntax.send({ type: 'ack' });
  vi.advanceTimersByTime(3000);
  expect(responses).toHaveLength(3);
});

test('transfers callable mode properties as RPC references', async () => {
  const [runnerAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();

  const plugin = new TestRunner(
    {} as IConduit,
    [runnerAutocomplete, runnerSyntax] as IChannel<unknown>[],
  );

  let transferredMode: TransferredSyntaxHighlightData | undefined;
  webSyntax.subscribe(message => {
    const syntaxMessage = message as SyntaxHighlightMessage;
    if (syntaxMessage.type === 'response') {
      transferredMode = syntaxMessage.data;
      webSyntax.send({ type: 'ack' });
    }
  });
  const remote = makeRpc<Record<never, never>, ModeRpc>(
    webSyntax as unknown as IChannel<IRpcMessage>,
    {},
  );

  webSyntax.send({ type: 'request' });

  expect(transferredMode?.indents).toEqual({ rpc: 'indents' });
  expect(transferredMode?.outdents).toEqual({ hookFrom: 'ace/mode/text' });
  expect(transferredMode?.autoOutdent).toEqual({ rpc: 'autoOutdent' });
  await expect(remote.indents('line')).resolves.toBe('indented:line');
  await expect(remote.autoOutdent('line')).resolves.toBe('outdented:line');
  expect(() =>
    (
      plugin as unknown as {
        __callModeFunction(name: keyof ModeRpc, args: unknown[]): unknown;
      }
    ).__callModeFunction('outdents', ['line']),
  ).toThrow('Mode function "outdents" is configured with a hook and cannot be called over RPC.');
});

test('exposes a callable outdents mode function over RPC', async () => {
  const [runnerAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  new FunctionOutdentsRunner(
    {} as IConduit,
    [runnerAutocomplete, runnerSyntax] as IChannel<unknown>[],
  );
  webSyntax.subscribe(message => {
    if ((message as SyntaxHighlightMessage).type === 'response') {
      webSyntax.send({ type: 'ack' });
    }
  });
  const remote = makeRpc<Record<never, never>, ModeRpc>(
    webSyntax as unknown as IChannel<IRpcMessage>,
    {},
  );

  webSyntax.send({ type: 'request' });

  await expect(remote.outdents('line')).resolves.toBe('should-outdent:line');
});
