import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  RUNNER_ID,
  type CseSnapshot,
  type CseSnapshotMessage,
} from "@sourceacademy/common-cse-machine";
import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";

/**
 * Runner-side CSE machine plugin.
 *
 * An evaluator (js-slang, py-slang, ...) registers this plugin and feeds it a batch of
 * language-agnostic {@link CseSnapshot}s via {@link CseMachinePlugin.sendSnapshots}; the
 * plugin forwards them over the {@link CSE_CHANNEL} to the web/host plugin, which renders
 * the CSE machine visualization.
 *
 * The serialization of a language's control/stash/environment into {@link CseSnapshot}s is
 * the evaluator's responsibility and stays in the evaluator repo — this plugin only owns the
 * transport, so it can be reused by every language.
 */
export class CseMachinePlugin implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [CSE_CHANNEL];

  private readonly __cseChannel: IChannel<CseSnapshotMessage>;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [cseChannel]: IChannel<any>[],
  ) {
    if (!cseChannel) {
      throw new Error("CSE channel is required but was not provided.");
    }
    this.__cseChannel = cseChannel;
  }

  /**
   * Send a full run's worth of snapshots to the host plugin.
   * @param snapshots The serialized evaluation snapshots, in step order.
   */
  sendSnapshots(snapshots: CseSnapshot[]): void {
    this.__cseChannel.send({
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots,
      totalSteps: snapshots.length,
    });
  }
}
