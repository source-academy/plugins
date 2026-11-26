import type {
  AnalysisMessage,
  AnalysisPosition,
  AnalysisRange,
  AutoCompleteEntry,
  SyntaxHighlightData,
} from "@sourceacademy/common-autocomplete";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { afterEach, expect, test, vi } from "vitest";

import { BaseAutoCompleteRunnerPlugin } from "..";

afterEach(() => {
  vi.useRealTimers();
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

const range = (line: number, from: number, to: number): AnalysisRange => ({
  start: { line, character: from },
  end: { line, character: to },
});

class PlainRunner extends BaseAutoCompleteRunnerPlugin {
  get mode(): SyntaxHighlightData {
    return {
      highlightRules: {},
      foldingRules: { hookFrom: "ace/mode/folding/cstyle", args: [] },
      lineCommentStart: "//",
      pairQuotesAfter: {},
      indents: { hookFrom: "ace/mode/text" },
      outdents: { hookFrom: "ace/mode/text" },
      autoOutdent: { hookFrom: "ace/mode/text" },
      id: "analysis-test",
    };
  }

  autocomplete(): AutoCompleteEntry[] {
    return [];
  }
}

class AnalysingRunner extends PlainRunner {
  calls: [string, string, AnalysisPosition][] = [];

  occurrences(code: string, position: AnalysisPosition): AnalysisRange[] {
    this.calls.push(["occurrences", code, position]);
    return [range(0, 4, 5), range(2, 0, 1)];
  }

  definition(code: string, position: AnalysisPosition): AnalysisRange | null {
    this.calls.push(["definition", code, position]);
    return position.line === 0 ? null : range(0, 4, 5);
  }

  scope(code: string, position: AnalysisPosition): AnalysisRange[] {
    this.calls.push(["scope", code, position]);
    return [range(0, 0, 20)];
  }
}

/** A runner plugin on a pair of channels, and what the web plugin side of the analysis channel hears. */
function attach<R extends PlainRunner>(
  Runner: new (conduit: IConduit, channels: IChannel<unknown>[]) => R,
) {
  const [runnerAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  const [runnerAnalysis, webAnalysis] = makeChannelPair();
  const heard: AnalysisMessage[] = [];
  webAnalysis.subscribe(message => heard.push(message as AnalysisMessage));
  const plugin = new Runner(
    {} as IConduit,
    [runnerAutocomplete, runnerSyntax, runnerAnalysis] as IChannel<unknown>[],
  );
  webSyntax.send({ type: "ack" });
  return { plugin, webAnalysis, heard };
}

test("announces on attach which analyses it provides", () => {
  expect(attach(AnalysingRunner).heard).toEqual([
    {
      type: "capabilities",
      capabilities: { occurrences: true, definition: true, scope: true },
    },
  ]);
});

test("provides only the analyses that it defines", () => {
  class OccurrencesOnly extends PlainRunner {
    occurrences(): AnalysisRange[] {
      return [];
    }
  }
  expect(attach(OccurrencesOnly).heard).toEqual([
    {
      type: "capabilities",
      capabilities: { occurrences: true, definition: false, scope: false },
    },
  ]);
});

test("a runner that defines none announces that it provides none", () => {
  expect(attach(PlainRunner).heard).toEqual([
    {
      type: "capabilities",
      capabilities: { occurrences: false, definition: false, scope: false },
    },
  ]);
});

test("announces again when asked", () => {
  const { webAnalysis, heard } = attach(AnalysingRunner);
  heard.length = 0;
  webAnalysis.send({ type: "request-capabilities" });
  expect(heard).toEqual([
    {
      type: "capabilities",
      capabilities: { occurrences: true, definition: true, scope: true },
    },
  ]);
});

test("answers the requests, with the id of each", () => {
  const { plugin, webAnalysis, heard } = attach(AnalysingRunner);
  heard.length = 0;
  const at = { line: 1, character: 2 };

  webAnalysis.send({ type: "request", requestId: 1, kind: "occurrences", code: "x", position: at });
  webAnalysis.send({ type: "request", requestId: 2, kind: "definition", code: "y", position: at });
  webAnalysis.send({
    type: "request",
    requestId: 3,
    kind: "definition",
    code: "z",
    position: { line: 0, character: 0 },
  });
  webAnalysis.send({ type: "request", requestId: 4, kind: "scope", code: "w", position: at });

  expect(heard).toEqual([
    {
      type: "response",
      requestId: 1,
      kind: "occurrences",
      ranges: [range(0, 4, 5), range(2, 0, 1)],
    },
    { type: "response", requestId: 2, kind: "definition", range: range(0, 4, 5) },
    { type: "response", requestId: 3, kind: "definition", range: null },
    { type: "response", requestId: 4, kind: "scope", ranges: [range(0, 0, 20)] },
  ]);
  expect(plugin.calls).toEqual([
    ["occurrences", "x", at],
    ["definition", "y", at],
    ["definition", "z", { line: 0, character: 0 }],
    ["scope", "w", at],
  ]);
});

test("says that it could not answer, instead of leaving the request pending", () => {
  class Throwing extends PlainRunner {
    occurrences(): AnalysisRange[] {
      throw new Error("does not parse");
    }
  }
  const { webAnalysis, heard } = attach(Throwing);
  heard.length = 0;
  const at = { line: 0, character: 0 };

  webAnalysis.send({ type: "request", requestId: 7, kind: "occurrences", code: "(", position: at });
  webAnalysis.send({ type: "request", requestId: 8, kind: "scope", code: "(", position: at });

  expect(heard).toEqual([
    { type: "error", requestId: 7, message: "does not parse" },
    { type: "error", requestId: 8, message: 'The analysis "scope" is not provided.' },
  ]);
});

test("a plugin made with the two channels that it had before still works", () => {
  const [runnerAutocomplete, webAutocomplete] = makeChannelPair();
  const [runnerSyntax, webSyntax] = makeChannelPair();
  const plugin = new AnalysingRunner(
    {} as IConduit,
    [runnerAutocomplete, runnerSyntax] as IChannel<unknown>[],
  );
  webSyntax.send({ type: "ack" });
  const heard: unknown[] = [];
  webAutocomplete.subscribe(message => heard.push(message));

  webAutocomplete.send({ type: "request", requestId: 1, code: "", row: 1, column: 1 });

  expect(plugin.calls).toEqual([]);
  expect(heard).toEqual([{ type: "response", requestId: 1, declarations: [] }]);
});
