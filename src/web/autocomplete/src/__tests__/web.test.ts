import type {
  ModeRpc,
  SyntaxHighlightData,
  SyntaxHighlightMessage,
} from "@sourceacademy/common-autocomplete";
import {
  makeRpc,
  type IChannel,
  type IConduit,
  type IRpcMessage,
} from "@sourceacademy/conductor/conduit";
import { expect, test } from "vitest";

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
