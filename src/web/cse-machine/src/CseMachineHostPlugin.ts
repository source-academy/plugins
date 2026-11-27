import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  WEB_ID,
  type CseMessage,
  type CseSnapshotBatchMessage,
  type CseSnapshot,
  type CseTraceEnd,
} from "@sourceacademy/common-cse-machine";
import type { IPlugin, IChannel, IConduit } from "@sourceacademy/conductor/conduit";

/**
 * Web/host-side CSE machine plugin.
 *
 * Subscribes to the {@link CSE_CHANNEL} and hands each received batch of {@link CseSnapshot}s
 * to the subclass via {@link CseMachineHostPlugin.receiveSnapshots}. {@link CseMachineTabPlugin}
 * is the subclass that draws them; before it existed, the frontend subclassed this (the published
 * `@sourceacademy/web-cse-machine` up to 3.1.0) and drew them itself.
 *
 * This plugin owns only the transport/receipt, so it is language-agnostic and reusable.
 */
export abstract class CseMachineHostPlugin implements IPlugin {
  readonly id: string = WEB_ID;
  static readonly channelAttach = [CSE_CHANNEL];

  /**
   * Called by the plugin with each received batch of snapshots.
   * Implement this in the host app to wire snapshots into the visualization layer.
   * @param breakpointSteps 0-based step indices where a breakpoint sits on top of the control.
   */
  abstract receiveSnapshots(snapshots: CseSnapshot[], breakpointSteps: number[]): void;

  /**
   * Called when a run that was sent in batches ends, with how it ended: complete, or cut off by the
   * runner (with the reason). Not called for a run that is stopped before it ends, nor for one sent
   * whole. Implement this in the host app to say so in the visualization; the default does nothing.
   */
  receiveEnd(_end: CseTraceEnd): void {}

  /** The snapshots of the run being received in batches, so far. */
  private __snapshots: CseSnapshot[] = [];
  private __breakpointSteps: number[] = [];

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [cseChannel]: IChannel<any>[],
  ) {
    if (!cseChannel) {
      throw new Error("CSE channel is required but was not provided.");
    }
    (cseChannel as IChannel<CseMessage>).subscribe(message => {
      if (message?.type === CSE_MESSAGE_TYPE_SNAPSHOT_BATCH) {
        this.__receiveBatch(message);
      } else if (
        message?.type === CSE_MESSAGE_TYPE_SNAPSHOTS &&
        Array.isArray(message.snapshots) &&
        message.totalSteps === message.snapshots.length
      ) {
        this.receiveSnapshots(
          message.snapshots,
          Array.isArray(message.breakpointSteps) ? message.breakpointSteps : [],
        );
      }
    });
  }

  /**
   * A batch continues the snapshots that came before it (index 0 starts the run afresh); one that
   * does not (a batch was missed) is dropped rather than put in the wrong place. The host gets the
   * snapshots so far each time, as it does for a whole run.
   */
  private __receiveBatch(message: CseSnapshotBatchMessage): void {
    if (!Array.isArray(message.snapshots) || message.index > this.__snapshots.length) return;
    this.__snapshots = this.__snapshots.slice(0, message.index).concat(message.snapshots);
    this.__breakpointSteps = (message.index === 0 ? [] : this.__breakpointSteps).concat(
      Array.isArray(message.breakpointSteps) ? message.breakpointSteps : [],
    );
    if (message.snapshots.length > 0) {
      this.receiveSnapshots(this.__snapshots, this.__breakpointSteps);
    }
    if (message.end) this.receiveEnd(message.end);
  }
}
