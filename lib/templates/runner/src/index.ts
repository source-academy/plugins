import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";
export abstract class PluginName implements IPlugin {
  readonly id: string = "__plugin_id";
  static readonly channelAttach = ["__channel_id"];
  private readonly __testChannel: IChannel<string>;
  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [testChannel]: IChannel<any>[],
  ) {
    this.__testChannel = testChannel;
    this.__testChannel.subscribe(message => {
      console.log(message);
    });
    this.__testChannel.send("ping");
  }
}
