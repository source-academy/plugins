import {
  makeRpc,
  type IChannel,
  type IConduit,
  type IPlugin,
  type IRpcMessage,
  type Remote,
} from "@sourceacademy/conductor/conduit";
import {
  ANALYSIS_CHANNEL_ID,
  AUTOCOMPLETE_CHANNEL_ID,
  SYNTAX_CHANNEL_ID,
  WEB_PLUGIN_ID,
  type AnalysisCapabilities,
  type AnalysisMessage,
  type AnalysisPosition,
  type AnalysisRange,
  type AnalysisRequestKind,
  type AutoCompleteMessage,
  type AutoCompleteResponse,
  type ModeFunction,
  type ModeRpc,
  type SyntaxHighlightData,
  type SyntaxHighlightMessage,
  type TransferredModeFunction,
  type TransferredSyntaxHighlightData,
} from "@sourceacademy/common-autocomplete";

let nextAutoCompleteRequestId = 0;
let nextAnalysisRequestId = 0;

export abstract class BaseAutoCompleteWebPlugin implements IPlugin {
  static readonly channelAttach = [AUTOCOMPLETE_CHANNEL_ID, SYNTAX_CHANNEL_ID, ANALYSIS_CHANNEL_ID];
  readonly id: string = WEB_PLUGIN_ID; // Should be migrated to an ID in v0.3.0
  private readonly __autoCompleteChannel: IChannel<AutoCompleteMessage>;
  private readonly __syntaxChannel: IChannel<SyntaxHighlightMessage>;
  /** Absent if the plugin is made with the two channels that it had before the analysis. */
  private readonly __analysisChannel?: IChannel<AnalysisMessage>;
  private __analysisCapabilities?: AnalysisCapabilities;
  private readonly __modeRpc: Remote<ModeRpc>;

  /**
   * The `autocomplete` method should return a list of autocomplete suggestions based on the provided code and cursor position.
   * The call is forwarded from the web plugin to the runner plugin, which processes the request and sends back the autocomplete suggestions.
   * @param code The current code in the editor.
   * @param row The current row of the cursor in the editor (1-indexed).
   * @param column The current column of the cursor in the editor (1-indexed).
   * @param callback The callback function to handle the autocomplete suggestions received from the runner plugin.
   */
  autocomplete(
    code: string,
    row: number,
    column: number,
    callback: (suggestions: AutoCompleteResponse) => void,
  ) {
    const requestId = nextAutoCompleteRequestId++;
    const handler = (message: AutoCompleteMessage) => {
      if (message.type === "response" && message.requestId === requestId) {
        this.__autoCompleteChannel.unsubscribe(handler);
        callback(message);
      }
    };
    this.__autoCompleteChannel.subscribe(handler);
    this.__autoCompleteChannel.send({
      type: "request",
      requestId,
      code,
      row,
      column,
    });
  }

  /**
   * Which analyses the runner plugin provides, or `undefined` until it has said (an evaluator that
   * does not know the analysis channel never does). An analysis is asked for only if the runner has
   * said that it has it; `onAnalysisCapabilities` is called when it does.
   */
  get analysisCapabilities(): AnalysisCapabilities | undefined {
    return this.__analysisCapabilities;
  }

  /**
   * Called when the runner plugin says which analyses it provides (and again if it says so anew).
   * Override it to enable the editor features that are built on them.
   * @param capabilities The analyses that the runner provides.
   */
  onAnalysisCapabilities(_capabilities: AnalysisCapabilities): void {}

  /**
   * Every occurrence, within its scope, of the name at `position`: what an editor highlights, and
   * what a rename edits. Empty if the runner does not provide it, or could not answer.
   * @param code The current code in the editor.
   * @param position The position of the cursor (0-based).
   */
  occurrences(code: string, position: AnalysisPosition): Promise<AnalysisRange[]> {
    return this.__askRanges("occurrences", code, position);
  }

  /**
   * The ranges of the scope that `position` is in. Empty if the runner does not provide it, or
   * could not answer.
   * @param code The current code in the editor.
   * @param position The position of the cursor (0-based).
   */
  scope(code: string, position: AnalysisPosition): Promise<AnalysisRange[]> {
    return this.__askRanges("scope", code, position);
  }

  /**
   * Where the name at `position` is declared. `null` if it is not declared in the code, if the
   * runner does not provide it, or if it could not answer.
   * @param code The current code in the editor.
   * @param position The position of the cursor (0-based).
   */
  async definition(code: string, position: AnalysisPosition): Promise<AnalysisRange | null> {
    const response = await this.__askAnalysis("definition", code, position);
    return response?.type === "response" && response.kind === "definition" ? response.range : null;
  }

  private async __askRanges(
    kind: "occurrences" | "scope",
    code: string,
    position: AnalysisPosition,
  ): Promise<AnalysisRange[]> {
    const response = await this.__askAnalysis(kind, code, position);
    return response?.type === "response" && response.kind !== "definition" ? response.ranges : [];
  }

  /** The runner's answer to a request, or `undefined` without asking if it does not provide it. */
  private __askAnalysis(
    kind: AnalysisRequestKind,
    code: string,
    position: AnalysisPosition,
  ): Promise<AnalysisMessage | undefined> {
    const channel = this.__analysisChannel;
    if (!channel || !this.__analysisCapabilities?.[kind]) {
      return Promise.resolve(undefined);
    }
    const requestId = nextAnalysisRequestId++;
    return new Promise(resolve => {
      const handler = (message: AnalysisMessage) => {
        if (
          (message.type === "response" || message.type === "error") &&
          message.requestId === requestId
        ) {
          channel.unsubscribe(handler);
          resolve(message);
        }
      };
      channel.subscribe(handler);
      channel.send({ type: "request", requestId, kind, code, position });
    });
  }

  /**
   * The `loadMode` method is called when the web plugin receives the syntax highlighting data from the runner plugin.
   * This method should be implemented to load the syntax highlighting mode based on the received data, enabling the web plugin to perform syntax highlighting of code in the editor.
   * @param data The syntax highlighting data received from the runner plugin
   */
  abstract loadMode(data: SyntaxHighlightData): void;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [autoCompleteChannel, syntaxChannel, analysisChannel]: IChannel<any>[],
  ) {
    this.__autoCompleteChannel = autoCompleteChannel;
    this.__syntaxChannel = syntaxChannel;
    this.__analysisChannel = analysisChannel;
    this.__modeRpc = makeRpc<Record<never, never>, ModeRpc>(
      this.__syntaxChannel as unknown as IChannel<IRpcMessage>,
      {},
    );
    const handler = (message: SyntaxHighlightMessage) => {
      if (message.type === "response") {
        this.__syntaxChannel.send({ type: "ack" });
        this.__syntaxChannel.unsubscribe(handler);
        this.loadMode(this.__hydrateMode(message.data));
      }
    };
    this.__syntaxChannel.subscribe(handler);
    this.__syntaxChannel.send({ type: "request" });

    this.__analysisChannel?.subscribe((message: AnalysisMessage) => {
      if (message.type === "capabilities") {
        this.__analysisCapabilities = message.capabilities;
        this.onAnalysisCapabilities(message.capabilities);
      }
    });
    this.__analysisChannel?.send({ type: "request-capabilities" });
  }

  private __hydrateMode(data: TransferredSyntaxHighlightData): SyntaxHighlightData {
    return {
      ...data,
      indents: this.__hydrateModeFunction(data.indents),
      outdents: this.__hydrateModeFunction(data.outdents),
      autoOutdent: this.__hydrateModeFunction(data.autoOutdent),
    };
  }

  private __hydrateModeFunction(fn: TransferredModeFunction): ModeFunction {
    if ("rpc" in fn) {
      const remote = this.__modeRpc[fn.rpc];
      return (...args: unknown[]) => remote(...args);
    }
    return fn;
  }
}
