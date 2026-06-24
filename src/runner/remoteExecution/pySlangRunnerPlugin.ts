import { remoteRunnerPlugin } from '@sourceacademy/runner-remote-execution';
import { IConduit, IChannel } from "@sourceacademy/conductor/conduit";

export class PySlangRunnerPlugin extends remoteRunnerPlugin {
  constructor(conduit: IConduit, channels: IChannel<any>[]) {
    super(conduit, channels);
  }
}