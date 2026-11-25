import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  RUNNER_ID,
  type CseMessage,
  type CseSnapshot,
  type CseTraceEnd,
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

  private readonly __cseChannel: IChannel<CseMessage>;
  /** The number of snapshots of the run being sent in batches that have gone out. */
  private __batchedSnapshots = 0;

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
   * @param breakpointSteps 0-based step indices where a breakpoint sits on top of the control.
   */
  sendSnapshots(snapshots: CseSnapshot[], breakpointSteps: number[] = []): void {
    this.__batchedSnapshots = 0;
    this.__cseChannel.send({
      type: CSE_MESSAGE_TYPE_SNAPSHOTS,
      snapshots,
      totalSteps: snapshots.length,
      breakpointSteps,
    });
  }

  /**
   * Send the next snapshots of the run that is going on, while it runs. A run sent this way is a
   * series of calls of this method followed by {@link endRun}; the first call after the last
   * `endRun` (or after {@link sendSnapshots}) starts a new run at the host, replacing what it had. A
   * run that the host stops, which terminates the worker, leaves the host with what was sent so far.
   *
   * @param snapshots The next serialized evaluation snapshots, in step order. Nothing is sent for none.
   * @param breakpointSteps The `stepIndex` of those of these snapshots where a breakpoint sits on
   *   top of the control (absolute step indices of the run, as for {@link sendSnapshots}).
   */
  sendBatch(snapshots: CseSnapshot[], breakpointSteps: number[] = []): void {
    if (snapshots.length === 0) return;
    this.__cseChannel.send({
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: this.__batchedSnapshots,
      snapshots,
      breakpointSteps,
    });
    this.__batchedSnapshots += snapshots.length;
  }

  /**
   * End the run being sent in batches, and say how it ended: by default it ran to its end; pass
   * `{ status: "cut-off", reason }` when the evaluator stopped recording before that, such as at a
   * limit of its own. Sends a last batch with no snapshots, since the end is known only after the
   * last step, and the next {@link sendBatch} starts a new run.
   */
  endRun(end: CseTraceEnd = { status: "complete" }): void {
    this.__cseChannel.send({
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: this.__batchedSnapshots,
      snapshots: [],
      end,
    });
    this.__batchedSnapshots = 0;
  }
}
