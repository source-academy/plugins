import type {
  AutoCompleteMessage,
  ModeRpc,
  SyntaxHighlightData,
  SyntaxHighlightMessage,
} from "@sourceacademy/common-autocomplete";
import {
  AUTOCOMPLETE_CHANNEL_ID,
  SYNTAX_CHANNEL_ID,
  WEB_PLUGIN_ID,
} from "@sourceacademy/common-autocomplete";
import {
  makeRpc,
  type IChannel,
  type IConduit,
  type IRpcMessage,
} from "@sourceacademy/conductor/conduit";
import { expect, test, vi } from "vitest";

import { BaseAutoCompleteWebPlugin } from "..";

class TestChannel<T> implements IChannel<T> {
  readonly name = "test";
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

test("exposes the web plugin identity and channel attachments", () => {
  const [runnerAutocomplete, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  runnerSyntax.subscribe(message => {
    if ((message as SyntaxHighlightMessage).type === "request") {
      runnerSyntax.send({
        type: "response",
        data: {
          highlightRules: {},
          foldingRules: { hookFrom: "ace/mode/folding/cstyle", args: [] },
          lineCommentStart: "//",
          pairQuotesAfter: {},
          indents: { hookFrom: "ace/mode/text" },
          outdents: { hookFrom: "ace/mode/text" },
          autoOutdent: { hookFrom: "ace/mode/text" },
          id: "identity-test",
        },
      });
    }
  });

  class TestWeb extends BaseAutoCompleteWebPlugin {
    loadMode(): void {}
  }
  const plugin = new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);

  expect(plugin.id).toBe(WEB_PLUGIN_ID);
  expect(BaseAutoCompleteWebPlugin.channelAttach).toEqual([
    AUTOCOMPLETE_CHANNEL_ID,
    SYNTAX_CHANNEL_ID,
  ]);
  expect(runnerAutocomplete).toBeDefined();
});

test("forwards autocomplete requests and unsubscribes after the response", () => {
  const [runnerAutocomplete, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  const requests: AutoCompleteMessage[] = [];
  runnerAutocomplete.subscribe(message => {
    const autocompleteMessage = message as AutoCompleteMessage;
    if (autocompleteMessage.type === "request") {
      requests.push(autocompleteMessage);
      runnerAutocomplete.send({
        type: "request",
        code: "ignored",
        row: 1,
        column: 1,
      });
      runnerAutocomplete.send({
        type: "response",
        declarations: [{ name: "answer", meta: "var" }],
      });
    }
  });
  runnerSyntax.subscribe(message => {
    if ((message as SyntaxHighlightMessage).type === "request") {
      runnerSyntax.send({
        type: "response",
        data: {
          highlightRules: {},
          foldingRules: { hookFrom: "ace/mode/folding/cstyle", args: [] },
          lineCommentStart: "//",
          pairQuotesAfter: {},
          indents: { hookFrom: "ace/mode/text" },
          outdents: { hookFrom: "ace/mode/text" },
          autoOutdent: { hookFrom: "ace/mode/text" },
          id: "autocomplete-test",
        },
      });
    }
  });

  class TestWeb extends BaseAutoCompleteWebPlugin {
    loadMode(): void {}
  }
  const plugin = new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);
  const callback = vi.fn();

  plugin.autocomplete("ans", 4, 2, callback);
  runnerAutocomplete.send({
    type: "response",
    declarations: [{ name: "ignored-second-response", meta: "var" }],
  });

  expect(requests).toEqual([{ type: "request", code: "ans", row: 4, column: 2 }]);
  expect(callback).toHaveBeenCalledOnce();
  expect(callback).toHaveBeenCalledWith({
    type: "response",
    declarations: [{ name: "answer", meta: "var" }],
  });
});

test("hydrates mode functions as RPC calls and preserves hooks", async () => {
  const [, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();

  makeRpc<ModeRpc, Record<never, never>>(runnerSyntax as unknown as IChannel<IRpcMessage>, {
    indents: (value: unknown) => `indented:${String(value)}`,
    outdents: () => false,
    autoOutdent: (value: unknown) => `outdented:${String(value)}`,
  });
  runnerSyntax.subscribe(message => {
    if ((message as SyntaxHighlightMessage).type === "request") {
      runnerSyntax.send({
        type: "response",
        data: {
          highlightRules: {},
          foldingRules: { hookFrom: "ace/mode/folding/cstyle", args: [] },
          lineCommentStart: "//",
          pairQuotesAfter: {},
          indents: { rpc: "indents" },
          outdents: { hookFrom: "ace/mode/text" },
          autoOutdent: { rpc: "autoOutdent" },
          id: "rpc-test",
        },
      });
    }
  });

  let loadedMode: SyntaxHighlightData | undefined;
  class TestWeb extends BaseAutoCompleteWebPlugin {
    loadMode(data: SyntaxHighlightData): void {
      loadedMode = data;
    }
  }

  new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);

  expect(loadedMode).toBeDefined();
  expect(loadedMode?.outdents).toEqual({ hookFrom: "ace/mode/text" });

  const indent = loadedMode?.indents;
  expect(typeof indent).toBe("function");
  if (typeof indent === "function") {
    await expect((indent as (...args: unknown[]) => unknown)("line")).resolves.toBe(
      "indented:line",
    );
  }

  const autoOutdent = loadedMode?.autoOutdent;
  expect(typeof autoOutdent).toBe("function");
  if (typeof autoOutdent === "function") {
    await expect((autoOutdent as (...args: unknown[]) => unknown)("line")).resolves.toBe(
      "outdented:line",
    );
  }
});

test("acknowledges and loads only the first syntax response", () => {
  const [, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  const acknowledgements: SyntaxHighlightMessage[] = [];
  runnerSyntax.subscribe(message => {
    const syntaxMessage = message as SyntaxHighlightMessage;
    if (syntaxMessage.type === "ack") {
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

  const data = {
    highlightRules: {},
    foldingRules: { hookFrom: "ace/mode/folding/cstyle", args: [] },
    lineCommentStart: "//",
    pairQuotesAfter: {},
    indents: { hookFrom: "ace/mode/text" },
    outdents: { hookFrom: "ace/mode/text" },
    autoOutdent: { hookFrom: "ace/mode/text" },
    id: "first-mode",
  } as const;
  runnerSyntax.send({ type: "request" });
  runnerSyntax.send({ type: "ack" });
  runnerSyntax.send({ type: "response", data });
  runnerSyntax.send({ type: "response", data: { ...data, id: "second-mode" } });

  expect(acknowledgements).toEqual([{ type: "ack" }]);
  expect(loadMode).toHaveBeenCalledOnce();
  expect(loadMode).toHaveBeenCalledWith(expect.objectContaining({ id: "first-mode" }));
});
