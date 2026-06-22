import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import {
  DATA_CHANNEL_ID,
  CONFIG_CHANNEL_ID,
  RUNNER_ID,
  type Data,
  type Config,
} from "@sourceacademy/common-data-display";

export abstract class BaseDataDisplayRunnerPlugin<T> implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [DATA_CHANNEL_ID, CONFIG_CHANNEL_ID];
  private readonly __dataChannel: IChannel<Data>;
  private readonly __configChannel: IChannel<Config | null>;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [dataChannel, configChannel]: IChannel<any>[],
  ) {
    this.__dataChannel = dataChannel;
    this.__configChannel = configChannel;
    // Provide the config to the web plugin when it requests it
    this.__configChannel.subscribe(() => {
      this.__configChannel.send(this.getConfig());
    });
  }

  abstract getConfig(): Config;
  abstract serialiseData(data: T): Data;
  sendData(data: T) {
    this.__dataChannel.send(this.serialiseData(data));
  }
}
