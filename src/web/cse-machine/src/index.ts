import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOTS,
  WEB_ID,
  type CseSnapshot,
  type CseSnapshotMessage,
} from '@sourceacademy/common-cse-machine';
import type { IChannel, IConduit, IPlugin } from '@sourceacademy/conductor/conduit';

// Re-export the protocol types so host apps can depend on a single package for the
// web side of the CSE machine.
export type {
  CseSnapshot,
  CseSerializedValue,
  CseSerializedInstruction,
  CseSerializedBinding,
  CseSerializedEnvFrame,
  CseSnapshotMessage,
} from '@sourceacademy/common-cse-machine';

/**
 * Web/host-side CSE machine plugin.
 *
 * Subscribes to the {@link CSE_CHANNEL} and hands each received batch of {@link CseSnapshot}s
 * to the host application via {@link CseMachineHostPlugin.receiveSnapshots}. The host app
 * (e.g. the Source Academy frontend) wires `receiveSnapshots` to its own visualization layer
 * (adapter + renderer), which stays in the host because it is tightly coupled to the existing
 * CSE machine UI.
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

  constructor(
    _conduit: IConduit,
    [cseChannel]: IChannel<any>[],
  ) {
    if (!cseChannel) {
      throw new Error('CSE channel is required but was not provided.');
    }
    (cseChannel as IChannel<CseSnapshotMessage>).subscribe(message => {
      if (
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
}
