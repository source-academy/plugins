export const WEB_ID = "__web_remote_execution";
export const RUNNER_ID = "__runner_remote_execution";

export const CHANNEL_ID = "remote-execution";

export const MESSAGE_TYPE_CONNECTION_STATUS = "connectionStatus";

/**
 * Mirrors the existing `DeviceConnection['status']` union from the frontend's
 * (non-conductor) remoteExecution feature, so a web-side consumer can reuse
 * the same state machine it already has for the legacy connection flow.
 */
export type ConnectionStatus = "CONNECTING" | "CONNECTED" | "FAILED";

export type ConnectionStatusMessage = {
  type: typeof MESSAGE_TYPE_CONNECTION_STATUS;
  status: ConnectionStatus;
};
