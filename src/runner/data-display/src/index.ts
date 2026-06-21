import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { CHANNEL_ID, RUNNER_ID, type Data } from "@sourceacademy/common-data-display";
export abstract class BaseDataDisplayRunnerPlugin<T> implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __dataChannel: IChannel<Data>;
  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [dataChannel]: IChannel<any>[],
  ) {
    this.__dataChannel = dataChannel;
  }

  abstract serialiseData(data: T): Data;
  sendData(data: T) {
    this.__dataChannel.send(this.serialiseData(data));
  }
}
