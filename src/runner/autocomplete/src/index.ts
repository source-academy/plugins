import type { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";

import {
  AUTOCOMPLETE_CHANNEL_ID,
  RUNNER_PLUGIN_ID,
  SYNTAX_CHANNEL_ID,
  type AutoCompleteEntry,
  type AutoCompleteMessage,
  type SyntaxHighlightData,
  type SyntaxHighlightMessage,
} from "@sourceacademy/common-autocomplete";

/**
 * This plugin provides autocomplete suggestions and syntax highlighting.
 *
 * It provides two channels: one for autocomplete requests and responses, and another for sending syntax highlighting information to the web plugin.
 *  - The autocomplete channel listens for requests containing the current code and cursor position. It uses the resolver to find relevant symbols based on the cursor position and sends back a response with the autocomplete suggestions.
 *  - The syntax highlighting channel periodically sends the mode information to the web plugin until it receives an acknowledgment, ensuring that the web plugin has the necessary information to perform syntax highlighting.
 */
export abstract class BaseAutoCompleteRunnerPlugin implements IPlugin {
  static readonly channelAttach = [AUTOCOMPLETE_CHANNEL_ID, SYNTAX_CHANNEL_ID];
  readonly id: string = RUNNER_PLUGIN_ID;

  private readonly __autoCompleteChannel: IChannel<AutoCompleteMessage>;
  private readonly __syntaxHighlightChannel: IChannel<SyntaxHighlightMessage>;

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

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [autoCompleteChannel, syntaxHighlightChannel]: IChannel<any>[],
  ) {
    this.__autoCompleteChannel = autoCompleteChannel;
    this.__syntaxHighlightChannel = syntaxHighlightChannel;
    const handler = setInterval(() => {
      this.__syntaxHighlightChannel.send({
        type: "response",
        data: this.mode,
      });
    }, 1000);
    this.__syntaxHighlightChannel.subscribe((message: SyntaxHighlightMessage) => {
      if (message.type === "ack") {
        clearInterval(handler);
      } else if (message.type === "request") {
        this.__syntaxHighlightChannel.send({
          type: "response",
          data: this.mode,
        });
      }
    });
    this.__autoCompleteChannel.subscribe((message: AutoCompleteMessage) => {
      if (message.type === "request") {
        const { code, row, column } = message;
        const entries = this.autocomplete(code, row, column);
        this.__autoCompleteChannel.send({
          type: "response",
          declarations: entries,
        });
      }
    });
  }
}
