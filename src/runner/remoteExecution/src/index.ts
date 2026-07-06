import {
  CHANNEL_ID,
  RUNNER_ID,
  MESSAGE_TYPE_CONNECTION_STATUS,
  type ConnectionStatusMessage,
  type ConnectionStatus,
} from "@sourceacademy/common-remote-execution";
import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";

export class RemoteExecutionPlugin implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __channel: IChannel<ConnectionStatusMessage>;

  constructor(_conduit: IConduit, [channel]: IChannel<any>[]) {
    if (!channel) {
      throw new Error("Remote execution channel is required but was not provided.");
    }
    this.__channel = channel;
  }

  sendConnectionStatus(status: ConnectionStatus): void {
    this.__channel.send({ type: MESSAGE_TYPE_CONNECTION_STATUS, status });
  }
}
