import {
  makeRpc,
  type IChannel,
  type IConduit,
  type IPlugin,
  type IRpcMessage,
} from "@sourceacademy/conductor/conduit";

import {
  ANALYSIS_CHANNEL_ID,
  AUTOCOMPLETE_CHANNEL_ID,
  RUNNER_PLUGIN_ID,
  SYNTAX_CHANNEL_ID,
  type AnalysisCapabilities,
  type AnalysisMessage,
  type AnalysisPosition,
  type AnalysisRange,
  type AnalysisRequest,
  type AutoCompleteEntry,
  type AutoCompleteMessage,
  type ModeFunction,
  type ModeRpc,
  type SyntaxHighlightData,
  type SyntaxHighlightMessage,
  type TransferredModeFunction,
  type TransferredSyntaxHighlightData,
} from "@sourceacademy/common-autocomplete";

const transferModeFunction = (name: keyof ModeRpc, fn: ModeFunction): TransferredModeFunction =>
  typeof fn === "function" ? { rpc: name } : fn;

/**
 * This plugin provides autocomplete suggestions and syntax highlighting.
 *
 * It provides three channels: one for autocomplete requests and responses, another for sending syntax highlighting information to the web plugin, and a third for editor analysis (see below).
 *  - The autocomplete channel listens for requests containing the current code and cursor position. It uses the resolver to find relevant symbols based on the cursor position and sends back a response with the autocomplete suggestions.
 *  - The syntax highlighting channel periodically sends the mode information to the web plugin until it receives an acknowledgment, ensuring that the web plugin has the necessary information to perform syntax highlighting.
 *  - The analysis channel answers the editor's questions about the code: where a name is used (`occurrences`), where it is declared (`definition`), and the scope that a position is in (`scope`). A runner provides each by defining the method of that name; it tells the web plugin which it has (see `AnalysisCapabilities`), and the web plugin asks only for those.
 */
export abstract class BaseAutoCompleteRunnerPlugin implements IPlugin {
  static readonly channelAttach = [AUTOCOMPLETE_CHANNEL_ID, SYNTAX_CHANNEL_ID, ANALYSIS_CHANNEL_ID];
  readonly id: string = RUNNER_PLUGIN_ID;

  private readonly __autoCompleteChannel: IChannel<AutoCompleteMessage>;
  private readonly __syntaxHighlightChannel: IChannel<SyntaxHighlightMessage>;
  /** Absent if the plugin is made with the two channels that it had before the analysis. */
  private readonly __analysisChannel?: IChannel<AnalysisMessage>;

  /**
   * The `mode` property should return the syntax highlighting data for the [Ace Editor mode](https://ace.c9.io/#nav=higlighter), which includes information about keywords, operators, and other syntax elements.\
   * This data is sent to the web plugin to enable proper syntax highlighting of code.
   */
  abstract get mode(): SyntaxHighlightData;

  /**
   * The `autocomplete` method should return a list of autocomplete suggestions based on the provided code and cursor position.
   * @param code The current code in the editor.
   * @param row The current row of the cursor in the editor (1-indexed)
   * @param column The current column of the cursor in the editor (1-indexed)
   * @returns A list of autocomplete entries relevant to the current cursor position in the code.
   */
  abstract autocomplete(code: string, row: number, column: number): AutoCompleteEntry[];

  /**
   * Every occurrence, within its scope, of the name at `position`: where the editor highlights the
   * uses of a name, and what a rename edits. Define it to provide the `occurrences` analysis.
   * @param code The current code in the editor.
   * @param position The position of the cursor (0-based).
   */
  occurrences?(code: string, position: AnalysisPosition): AnalysisRange[];

  /**
   * Where the name at `position` is declared, or `null` if it is not declared in the code (a name of
   * the language's library, for example). Define it to provide the `definition` analysis.
   * @param code The current code in the editor.
   * @param position The position of the cursor (0-based).
   */
  definition?(code: string, position: AnalysisPosition): AnalysisRange | null;

  /**
   * The ranges of the scope that `position` is in. Define it to provide the `scope` analysis.
   * @param code The current code in the editor.
   * @param position The position of the cursor (0-based).
   */
  scope?(code: string, position: AnalysisPosition): AnalysisRange[];

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [autoCompleteChannel, syntaxHighlightChannel, analysisChannel]: IChannel<any>[],
  ) {
    this.__autoCompleteChannel = autoCompleteChannel;
    this.__syntaxHighlightChannel = syntaxHighlightChannel;
    this.__analysisChannel = analysisChannel;

    makeRpc<ModeRpc, Record<never, never>>(
      this.__syntaxHighlightChannel as unknown as IChannel<IRpcMessage>,
      {
        indents: (...args: unknown[]) => this.__callModeFunction("indents", args),
        outdents: (...args: unknown[]) => this.__callModeFunction("outdents", args),
        autoOutdent: (...args: unknown[]) => this.__callModeFunction("autoOutdent", args),
      },
    );

    const handler = setInterval(() => {
      this.__syntaxHighlightChannel.send({
        type: "response",
        data: this.__transferMode(),
      });
    }, 1000);
    this.__syntaxHighlightChannel.subscribe((message: SyntaxHighlightMessage) => {
      if (message.type === "ack") {
        clearInterval(handler);
      } else if (message.type === "request") {
        this.__syntaxHighlightChannel.send({
          type: "response",
          data: this.__transferMode(),
        });
      }
    });
    this.__analysisChannel?.subscribe((message: AnalysisMessage) => {
      if (message.type === "request-capabilities") {
        this.__analysisChannel!.send({
          type: "capabilities",
          capabilities: this.__analysisCapabilities(),
        });
      } else if (message.type === "request") {
        this.__analysisChannel!.send(this.__answerAnalysis(message));
      }
    });
    // Without waiting to be asked: the web plugin may attach before or after this one.
    this.__analysisChannel?.send({
      type: "capabilities",
      capabilities: this.__analysisCapabilities(),
    });
    this.__autoCompleteChannel.subscribe((message: AutoCompleteMessage) => {
      if (message.type === "request") {
        const { requestId, code, row, column } = message;
        const entries = this.autocomplete(code, row, column);
        this.__autoCompleteChannel.send({
          type: "response",
          requestId,
          declarations: entries,
        });
      }
    });
  }

  private __analysisCapabilities(): AnalysisCapabilities {
    return {
      occurrences: typeof this.occurrences === "function",
      definition: typeof this.definition === "function",
      scope: typeof this.scope === "function",
    };
  }

  private __answerAnalysis(message: AnalysisRequest): AnalysisMessage {
    const { requestId, kind, code, position } = message;
    try {
      if (!this.__analysisCapabilities()[kind]) {
        return { type: "error", requestId, message: `The analysis "${kind}" is not provided.` };
      }
      if (kind === "definition") {
        return { type: "response", requestId, kind, range: this.definition!(code, position) };
      }
      const ranges =
        kind === "occurrences" ? this.occurrences!(code, position) : this.scope!(code, position);
      return { type: "response", requestId, kind, ranges };
    } catch (error) {
      return {
        type: "error",
        requestId,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private __transferMode(): TransferredSyntaxHighlightData {
    const mode = this.mode;
    return {
      ...mode,
      indents: transferModeFunction("indents", mode.indents),
      outdents: transferModeFunction("outdents", mode.outdents),
      autoOutdent: transferModeFunction("autoOutdent", mode.autoOutdent),
    };
  }

  private __callModeFunction(name: keyof ModeRpc, args: unknown[]): unknown {
    const mode = this.mode;
    const fn = mode[name];
    if (typeof fn !== "function") {
      throw new Error(
        `Mode function "${name}" is configured with a hook and cannot be called over RPC.`,
      );
    }
    return Reflect.apply(fn, mode, args);
  }
}
