import {
  AUTOCOMPLETE_CHANNEL_ID,
  SYNTAX_CHANNEL_ID,
  WEB_PLUGIN_ID,
  type AutoCompleteMessage,
  type ModeRpc,
  type SyntaxHighlightData,
  type SyntaxHighlightMessage,
} from '@sourceacademy/common-autocomplete';
import {
  makeRpc,
  type IChannel,
  type IConduit,
  type IRpcMessage,
} from '@sourceacademy/conductor/conduit';
import { expect, test, vi } from 'vitest';

import { BaseAutoCompleteWebPlugin } from '..';

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

const makeSyntaxData = (id: string) =>
  ({
    highlightRules: {},
    foldingRules: { hookFrom: 'ace/mode/folding/cstyle', args: [] },
    lineCommentStart: '//',
    pairQuotesAfter: {},
    indents: { hookFrom: 'ace/mode/text' },
    outdents: { hookFrom: 'ace/mode/text' },
    autoOutdent: { hookFrom: 'ace/mode/text' },
    id,
  }) as const;

test('exposes its identity and defers mode loading until after subclass initialization', () => {
  const [, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();

  class TestWeb extends BaseAutoCompleteWebPlugin {
    private initialized = false;
    loadedModeId: string | undefined;

    constructor(conduit: IConduit, channels: IChannel<unknown>[]) {
      super(conduit, channels);
      this.initialized = true;
    }

    loadMode(data: SyntaxHighlightData): void {
      if (!this.initialized) {
        throw new Error('loadMode called before subclass initialization');
      }
      this.loadedModeId = data.id;
    }
  }
  const plugin = new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);
  runnerSyntax.send({ type: 'response', data: makeSyntaxData('identity-test') });

  expect(plugin.id).toBe(WEB_PLUGIN_ID);
  expect(plugin.loadedModeId).toBe('identity-test');
  expect(BaseAutoCompleteWebPlugin.channelAttach).toEqual([
    AUTOCOMPLETE_CHANNEL_ID,
    SYNTAX_CHANNEL_ID,
  ]);
});

test('forwards autocomplete requests and unsubscribes after the matching response', () => {
  const [runnerAutocomplete, webAutocomplete] = makeChannelPair();
  const [, webSyntax] = makeChannelPair();
  const requests: Extract<AutoCompleteMessage, { type: 'request' }>[] = [];
  runnerAutocomplete.subscribe(message => {
    const autocompleteMessage = message as AutoCompleteMessage;
    if (autocompleteMessage.type === 'request') {
      requests.push(autocompleteMessage);
      runnerAutocomplete.send({
        type: 'request',
        requestId: -1,
        code: 'ignored',
        row: 1,
        column: 1,
      });
      runnerAutocomplete.send({
        type: 'response',
        requestId: autocompleteMessage.requestId,
        declarations: [{ name: 'answer', meta: 'var' }],
      });
    }
  });

  class TestWeb extends BaseAutoCompleteWebPlugin {
    loadMode(): void {}
  }
  const plugin = new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);
  const callback = vi.fn();

  plugin.autocomplete('ans', 4, 2, callback);
  runnerAutocomplete.send({
    type: 'response',
    requestId: requests[0].requestId,
    declarations: [{ name: 'ignored-second-response', meta: 'var' }],
  });

  expect(requests).toEqual([
    {
      type: 'request',
      requestId: expect.any(Number),
      code: 'ans',
      row: 4,
      column: 2,
    },
  ]);
  expect(callback).toHaveBeenCalledExactlyOnceWith({
    type: 'response',
    requestId: requests[0].requestId,
    declarations: [{ name: 'answer', meta: 'var' }],
  });
});

test('keeps overlapping autocomplete responses correlated with their requests', () => {
  const [runnerAutocomplete, webAutocomplete] = makeChannelPair();
  const [, webSyntax] = makeChannelPair();
  const requests: Extract<AutoCompleteMessage, { type: 'request' }>[] = [];
  runnerAutocomplete.subscribe(message => {
    const autocompleteMessage = message as AutoCompleteMessage;
    if (autocompleteMessage.type === 'request') {
      requests.push(autocompleteMessage);
    }
  });

  class TestWeb extends BaseAutoCompleteWebPlugin {
    loadMode(): void {}
  }
  const plugin = new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);
  const firstCallback = vi.fn();
  const secondCallback = vi.fn();

  plugin.autocomplete('first', 1, 5, firstCallback);
  plugin.autocomplete('second', 2, 6, secondCallback);
  expect(requests).toHaveLength(2);

  runnerAutocomplete.send({
    type: 'response',
    requestId: Math.max(requests[0].requestId, requests[1].requestId) + 1000,
    declarations: [{ name: 'unmatched', meta: 'var' }],
  });
  runnerAutocomplete.send({
    type: 'response',
    requestId: requests[1].requestId,
    declarations: [{ name: 'second-result', meta: 'var' }],
  });
  runnerAutocomplete.send({
    type: 'response',
    requestId: requests[0].requestId,
    declarations: [{ name: 'first-result', meta: 'var' }],
  });

  expect(firstCallback).toHaveBeenCalledExactlyOnceWith({
    type: 'response',
    requestId: requests[0].requestId,
    declarations: [{ name: 'first-result', meta: 'var' }],
  });
  expect(secondCallback).toHaveBeenCalledExactlyOnceWith({
    type: 'response',
    requestId: requests[1].requestId,
    declarations: [{ name: 'second-result', meta: 'var' }],
  });
});

test('hydrates mode functions as RPC calls and preserves hooks', async () => {
  const [, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();

  makeRpc<ModeRpc, Record<never, never>>(runnerSyntax as unknown as IChannel<IRpcMessage>, {
    indents: (value: unknown) => `indented:${String(value)}`,
    outdents: () => false,
    autoOutdent: (value: unknown) => `outdented:${String(value)}`,
  });

  let loadedMode: SyntaxHighlightData | undefined;
  class TestWeb extends BaseAutoCompleteWebPlugin {
    loadMode(data: SyntaxHighlightData): void {
      loadedMode = data;
    }
  }

  new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);
  runnerSyntax.send({
    type: 'response',
    data: {
      ...makeSyntaxData('rpc-test'),
      indents: { rpc: 'indents' },
      autoOutdent: { rpc: 'autoOutdent' },
    },
  });

  expect(loadedMode).toBeDefined();
  expect(loadedMode?.outdents).toEqual({ hookFrom: 'ace/mode/text' });

  const indent = loadedMode?.indents;
  expect(typeof indent).toBe('function');
  await expect((indent as (...args: unknown[]) => unknown)('line')).resolves.toBe('indented:line');

  const autoOutdent = loadedMode?.autoOutdent;
  expect(typeof autoOutdent).toBe('function');
  await expect((autoOutdent as (...args: unknown[]) => unknown)('line')).resolves.toBe(
    'outdented:line',
  );
});

test('acknowledges and loads only the first syntax response', () => {
  const [, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  const acknowledgements: SyntaxHighlightMessage[] = [];
  runnerSyntax.subscribe(message => {
    const syntaxMessage = message as SyntaxHighlightMessage;
    if (syntaxMessage.type === 'ack') {
      acknowledgements.push(syntaxMessage);
    }
  });

  const loadMode = vi.fn();
  class TestWeb extends BaseAutoCompleteWebPlugin {
    loadMode(data: SyntaxHighlightData): void {
      loadMode(data);
    }
  }
  new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);

  const data = makeSyntaxData('first-mode');
  runnerSyntax.send({ type: 'request' });
  runnerSyntax.send({ type: 'ack' });
  runnerSyntax.send({ type: 'response', data });
  runnerSyntax.send({ type: 'response', data: { ...data, id: 'second-mode' } });

  expect(acknowledgements).toEqual([{ type: 'ack' }]);
  expect(loadMode).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ id: 'first-mode' }));
});
