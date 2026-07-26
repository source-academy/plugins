import type { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";
import { AUTOCOMPLETE_CHANNEL_ID, SYNTAX_CHANNEL_ID, WEB_PLUGIN_ID, type AutoCompleteMessage, type AutoCompleteResponse, type SyntaxHighlightMessage, type SyntaxHighlightData } from "@sourceacademy/common-autocomplete";

export abstract class BaseAutoCompleteWebPlugin implements IPlugin {
  static readonly channelAttach = [AUTOCOMPLETE_CHANNEL_ID, SYNTAX_CHANNEL_ID];
  readonly id: string = WEB_PLUGIN_ID; // Should be migrated to an ID in v0.3.0
  private readonly __autoCompleteChannel: IChannel<AutoCompleteMessage>;
  private readonly __syntaxChannel: IChannel<SyntaxHighlightMessage>;

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
    const handler = (message: AutoCompleteMessage) => {
      if (message.type === "response") {
        this.__autoCompleteChannel.unsubscribe(handler);
        callback(message);
      }
    };
    this.__autoCompleteChannel.subscribe(handler);
    this.__autoCompleteChannel.send({
      type: "request",
      code,
      row,
      column,
    });
  }

  /**
   * The `loadMode` method is called when the web plugin receives the syntax highlighting data from the runner plugin.
   * This method should be implemented to load the syntax highlighting mode based on the received data, enabling the web plugin to perform syntax highlighting of code in the editor.
   * @param data The syntax highlighting data received from the runner plugin
   */
  abstract loadMode(data: SyntaxHighlightData): void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_conduit: IConduit, [autoCompleteChannel, syntaxChannel]: IChannel<any>[]) {
    this.__autoCompleteChannel = autoCompleteChannel;
    this.__syntaxChannel = syntaxChannel;
    this.__syntaxChannel.send({ type: "request" });
    const handler = (message: SyntaxHighlightMessage) => {
      if (message.type === "response") {
        this.__syntaxChannel.send({ type: "ack" });
        this.__syntaxChannel.unsubscribe(handler);
        const data = message.data;
        this.loadMode(data);
      }
    };
    this.__syntaxChannel.subscribe(handler);
  }
}