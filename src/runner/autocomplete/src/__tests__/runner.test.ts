import { BaseAutoCompleteRunnerPlugin } from "..";
import {
  SYNTAX_CHANNEL_ID,
  AUTOCOMPLETE_CHANNEL_ID,
  type AutoCompleteEntry,
  type ModeRpc,
  type SyntaxHighlightData,
  type SyntaxHighlightMessage,
  type TransferredSyntaxHighlightData,
} from "@sourceacademy/common-autocomplete";
import {
  makeRpc,
  type IChannel,
  type IConduit,
  type IRpcMessage,
} from "@sourceacademy/conductor/conduit";
import { test, expect } from "vitest";

test("should have a valid channel id", () => {
  expect(BaseAutoCompleteRunnerPlugin.channelAttach).toEqual([
    AUTOCOMPLETE_CHANNEL_ID,
    SYNTAX_CHANNEL_ID,
  ]);
});

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

test("transfers callable mode properties as RPC references", async () => {
  const [runnerAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();

  class TestRunner extends BaseAutoCompleteRunnerPlugin {
    get mode(): SyntaxHighlightData {
      return {
        highlightRules: {},
        foldingRules: { hookFrom: "ace/mode/folding/cstyle", args: [] },
        lineCommentStart: "//",
        pairQuotesAfter: {},
        indents: (value: string) => `indented:${value}`,
        outdents: { hookFrom: "ace/mode/text" },
        autoOutdent: { hookFrom: "ace/mode/text" },
        id: "rpc-test",
      };
    }

    autocomplete(): AutoCompleteEntry[] {
      return [];
    }
  }

  new TestRunner({} as IConduit, [runnerAutocomplete, runnerSyntax] as IChannel<unknown>[]);

  let transferredMode: TransferredSyntaxHighlightData | undefined;
  webSyntax.subscribe(message => {
    const syntaxMessage = message as SyntaxHighlightMessage;
    if (syntaxMessage.type === "response") {
      transferredMode = syntaxMessage.data;
      webSyntax.send({ type: "ack" });
    }
  });
  const remote = makeRpc<Record<never, never>, ModeRpc>(
    webSyntax as unknown as IChannel<IRpcMessage>,
    {},
  );

  webSyntax.send({ type: "request" });

  expect(transferredMode?.indents).toEqual({ rpc: "indents" });
  expect(transferredMode?.outdents).toEqual({ hookFrom: "ace/mode/text" });
  await expect(remote.indents("line")).resolves.toBe("indented:line");
});
