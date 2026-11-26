import type {
  AnalysisCapabilities,
  AnalysisMessage,
  AnalysisRange,
} from "@sourceacademy/common-autocomplete";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
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

  get subscriberCount(): number {
    return this.subscribers.size;
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
const at = { line: 3, character: 5 };
const all: AnalysisCapabilities = { occurrences: true, definition: true, scope: true };

class TestWeb extends BaseAutoCompleteWebPlugin {
  announced: AnalysisCapabilities[] = [];

  loadMode(): void {}

  override onAnalysisCapabilities(capabilities: AnalysisCapabilities): void {
    this.announced.push(capabilities);
  }
}

/**
 * A web plugin, and the runner end of its analysis channel: `heard` is what the runner hears, and
 * `answer` makes the runner answer each request with what the function returns.
 */
function attach() {
  const [, webAutocomplete] = makeChannelPair();
  const [, webSyntax] = makeChannelPair();
  const [runnerAnalysis, webAnalysis] = makeChannelPair();
  const heard: AnalysisMessage[] = [];
  let reply:
    ((request: Extract<AnalysisMessage, { type: "request" }>) => AnalysisMessage[]) | undefined;
  runnerAnalysis.subscribe(message => {
    const analysisMessage = message as AnalysisMessage;
    heard.push(analysisMessage);
    if (analysisMessage.type === "request") {
      for (const answer of reply?.(analysisMessage) ?? []) {
        runnerAnalysis.send(answer);
      }
    }
  });
  const plugin = new TestWeb(
    {} as IConduit,
    [webAutocomplete, webSyntax, webAnalysis] as IChannel<unknown>[],
  );
  return {
    plugin,
    heard,
    runnerAnalysis,
    webAnalysis,
    answer: (fn: NonNullable<typeof reply>) => {
      reply = fn;
    },
  };
}

test("asks which analyses the runner provides, as it attaches", () => {
  expect(attach().heard).toEqual([{ type: "request-capabilities" }]);
});

test("knows nothing of the capabilities until the runner has announced them", () => {
  const { plugin, runnerAnalysis } = attach();
  expect(plugin.analysisCapabilities).toBeUndefined();

  runnerAnalysis.send({ type: "capabilities", capabilities: all });

  expect(plugin.analysisCapabilities).toEqual(all);
  expect(plugin.announced).toEqual([all]);
});

test("is told again when the runner announces anew", () => {
  const { plugin, runnerAnalysis } = attach();
  runnerAnalysis.send({ type: "capabilities", capabilities: all });
  const fewer = { occurrences: true, definition: false, scope: false };
  runnerAnalysis.send({ type: "capabilities", capabilities: fewer });

  expect(plugin.analysisCapabilities).toEqual(fewer);
  expect(plugin.announced).toEqual([all, fewer]);
});

test("does not ask a runner that has not announced the analysis, and answers nothing", async () => {
  const { plugin, heard } = attach();
  heard.length = 0;

  expect(await plugin.occurrences("x", at)).toEqual([]);
  expect(await plugin.scope("x", at)).toEqual([]);
  expect(await plugin.definition("x", at)).toBeNull();
  expect(heard).toEqual([]);
});

test("does not ask a runner for an analysis that it has said that it does not provide", async () => {
  const { plugin, runnerAnalysis, heard } = attach();
  runnerAnalysis.send({
    type: "capabilities",
    capabilities: { occurrences: true, definition: false, scope: false },
  });
  heard.length = 0;

  expect(await plugin.definition("x", at)).toBeNull();
  expect(heard).toEqual([]);
});

test("asks the runner, and resolves with its ranges", async () => {
  const { plugin, runnerAnalysis, heard, answer } = attach();
  runnerAnalysis.send({ type: "capabilities", capabilities: all });
  heard.length = 0;
  answer(request => [
    {
      type: "response",
      requestId: request.requestId,
      kind: request.kind as "occurrences",
      ranges: [range(1, 2, 3)],
    },
  ]);

  expect(await plugin.occurrences("let x;", at)).toEqual([range(1, 2, 3)]);
  expect(heard).toEqual([
    {
      type: "request",
      requestId: expect.any(Number),
      kind: "occurrences",
      code: "let x;",
      position: at,
    },
  ]);
});

test("resolves a definition, or null where the name is not declared", async () => {
  const { plugin, runnerAnalysis, answer } = attach();
  runnerAnalysis.send({ type: "capabilities", capabilities: all });

  answer(request => [
    { type: "response", requestId: request.requestId, kind: "definition", range: range(0, 4, 5) },
  ]);
  expect(await plugin.definition("x", at)).toEqual(range(0, 4, 5));

  answer(request => [
    { type: "response", requestId: request.requestId, kind: "definition", range: null },
  ]);
  expect(await plugin.definition("x", at)).toBeNull();
});

test("resolves with nothing when the runner could not answer", async () => {
  const { plugin, runnerAnalysis, answer } = attach();
  runnerAnalysis.send({ type: "capabilities", capabilities: all });
  answer(request => [{ type: "error", requestId: request.requestId, message: "does not parse" }]);

  expect(await plugin.occurrences("(", at)).toEqual([]);
  expect(await plugin.scope("(", at)).toEqual([]);
  expect(await plugin.definition("(", at)).toBeNull();
});

test("takes the answer to its own request, whatever else the runner says", async () => {
  const { plugin, runnerAnalysis, answer } = attach();
  runnerAnalysis.send({ type: "capabilities", capabilities: all });
  answer(request => [
    {
      type: "response",
      requestId: request.requestId + 1000,
      kind: "occurrences",
      ranges: [range(9, 9, 9)],
    },
    { type: "capabilities", capabilities: all },
    {
      type: "response",
      requestId: request.requestId,
      kind: "occurrences",
      ranges: [range(1, 1, 2)],
    },
  ]);

  expect(await plugin.occurrences("x", at)).toEqual([range(1, 1, 2)]);
});

test("keeps the answers of overlapping requests apart", async () => {
  const { plugin, runnerAnalysis, heard } = attach();
  runnerAnalysis.send({ type: "capabilities", capabilities: all });
  heard.length = 0;

  const first = plugin.occurrences("a", at);
  const second = plugin.occurrences("b", at);
  const requests = heard.filter(message => message.type === "request");
  expect(requests).toHaveLength(2);
  // The answers come in the opposite order.
  runnerAnalysis.send({
    type: "response",
    requestId: requests[1].requestId,
    kind: "occurrences",
    ranges: [range(2, 0, 1)],
  });
  runnerAnalysis.send({
    type: "response",
    requestId: requests[0].requestId,
    kind: "occurrences",
    ranges: [range(1, 0, 1)],
  });

  expect(await first).toEqual([range(1, 0, 1)]);
  expect(await second).toEqual([range(2, 0, 1)]);
});

test("stops listening once a request is answered", async () => {
  const { plugin, runnerAnalysis, webAnalysis, answer } = attach();
  runnerAnalysis.send({ type: "capabilities", capabilities: all });
  const before = webAnalysis.subscriberCount;
  answer(request => [
    { type: "response", requestId: request.requestId, kind: "scope", ranges: [] },
  ]);

  await plugin.scope("x", at);

  expect(webAnalysis.subscriberCount).toBe(before);
});

test("a plugin made with the two channels that it had before still works", async () => {
  const [, webAutocomplete] = makeChannelPair();
  const [, webSyntax] = makeChannelPair();
  const plugin = new TestWeb({} as IConduit, [webAutocomplete, webSyntax] as IChannel<unknown>[]);

  expect(plugin.analysisCapabilities).toBeUndefined();
  expect(await plugin.occurrences("x", at)).toEqual([]);
});
