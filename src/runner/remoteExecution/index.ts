import { CHANNEL_ID, RUNNER_ID, type PySlangMessage } from "@sourceacademy/common-test";
import { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { EV3Engine } from "py-slang/src/engines/ev3/EV3Engine";

export abstract class remoteRunnerPlugin implements IPlugin {
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
        if (result.status === "finished") {
          this.__channel.send({ 
            type: "result", 
            output: result.output ?? "" // raw SVML, not JSON stringified
          });
        } else {
          this.__channel.send({ 
            type: "error", 
            message: result.error ?? "Unknown error" 
          });
        }
      }
    });
  }

  async sendCode(code: string): Promise<PySlangMessage> {
    return new Promise((resolve) => {
      const handler = (message: PySlangMessage) => {
        if (message.type === 'result' || message.type === 'error') {
          this.__channel.unsubscribe(handler);
          resolve(message);
        }
      };
      this.__channel.subscribe(handler);
      this.__channel.send({ type: 'run', code });
    });
  }
}