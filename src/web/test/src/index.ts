import { CHANNEL_ID, WEB_ID, type TestMessage } from "@sourceacademy/common-test";
import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";

export abstract class TestPlugin implements IPlugin {
  readonly id: string = WEB_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __testChannel: IChannel<TestMessage>;
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
