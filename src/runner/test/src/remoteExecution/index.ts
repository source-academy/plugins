import { CHANNEL_ID, RUNNER_ID, type PySlangMessage } from "@sourceacademy/common-test";
import { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { EV3Engine } from "C:/Users/Migue/OneDrive/Desktop/Projects/py-slang-2/src/engines/ev3/EV3Engine";

export class remoteRunnerPlugin implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __channel: IChannel<PySlangMessage>;
  private readonly engine: EV3Engine;

  constructor(
    _conduit: IConduit,
    [channel]: IChannel<any>[],
  ) {
    this.__channel = channel;
    this.engine = new EV3Engine();

    this.__channel.subscribe(async message => {
      if (message.type === "run") {
        const result = await this.engine.execute(message.code);
        console.log("Engine response:", result);
        // Sling integration TODO
      }
    });
  }
}