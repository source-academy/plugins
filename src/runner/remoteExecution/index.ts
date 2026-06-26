import { CHANNEL_ID, RUNNER_ID, type PySlangMessage } from "@sourceacademy/common-test";
import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { EV3Engine } from "py-slang/src/engines/ev3/EV3Engine";

export class RemoteRunnerPlugin implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __channel: IChannel<PySlangMessage>;
  private readonly engine: EV3Engine;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(_conduit: IConduit, [channel]: IChannel<any>[]) {
    this.__channel = channel;
    this.engine = new EV3Engine();

    this.__channel.subscribe(async message => {
      if (message.type === "run") {
        try {
          const result = await this.engine.execute(message.code);
          console.log("Engine response:", result);
          this.__channel.send({ type: "result", output: JSON.stringify(result) });
        } catch (error: any) {
          this.__channel.send({
            type: "error",
            message: error?.message ?? String(error)
          });
        }
      }
    });
  }
}
