import {
  CHANNEL_ID,
  RUNNER_ID,
  SoundIOMessageType,
  type SoundIOMessage,
} from "@sourceacademy/common-sound-io";
import { checkIsPluginClass, type IChannel, type IConduit, type IPlugin } from "@sourceacademy/conductor/conduit";

/**
 * Runner-side bridge for sound playback and recording. The actual Web Audio/MediaRecorder work
 * happens on the web host (see @sourceacademy/web-sound-io) since those APIs aren't available
 * inside the runner's worker; this plugin just sends requests over the shared channel and
 * resolves/rejects once the host responds.
 */
export class SoundIORunnerPlugin implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __channel: IChannel<SoundIOMessage>;
  private __nextRequestId = 0;

  static instance: SoundIORunnerPlugin | null = null;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [channel]: IChannel<any>[],
  ) {
    this.__channel = channel;
    SoundIORunnerPlugin.instance = this;
  }

  private __request<TResponse extends SoundIOMessage>(
    message: SoundIOMessage,
    transfer: Transferable[],
    isResponse: (msg: SoundIOMessage, requestId: number) => msg is TResponse,
    isError: (msg: SoundIOMessage, requestId: number) => msg is SoundIOMessage & { error: string },
  ): Promise<TResponse> {
    const requestId = message.requestId;
    return new Promise((resolve, reject) => {
      const handleResponse = (msg: SoundIOMessage) => {
        if (isResponse(msg, requestId)) {
          this.__channel.unsubscribe(handleResponse);
          resolve(msg);
        } else if (isError(msg, requestId)) {
          this.__channel.unsubscribe(handleResponse);
          reject(new Error(msg.error));
        }
      };
      this.__channel.subscribe(handleResponse);
      this.__channel.send(message, transfer);
    });
  }

  /** Plays `samples` (at `sampleRate` Hz) through the host's audio output, resolving once playback ends. */
  async playSamples(samples: Float32Array, sampleRate: number): Promise<void> {
    const requestId = this.__nextRequestId++;
    await this.__request(
      { type: SoundIOMessageType.PLAY_SAMPLES, requestId, samples, sampleRate },
      [samples.buffer],
      (msg, id): msg is Extract<SoundIOMessage, { type: SoundIOMessageType.PLAYBACK_ENDED }> =>
        msg.type === SoundIOMessageType.PLAYBACK_ENDED && msg.requestId === id,
      (msg, id): msg is Extract<SoundIOMessage, { type: SoundIOMessageType.PLAYBACK_ERROR }> =>
        msg.type === SoundIOMessageType.PLAYBACK_ERROR && msg.requestId === id,
    );
  }

  /** Stops whatever the host is currently playing. Fire-and-forget; there is nothing to await. */
  stopPlayback(): void {
    this.__channel.send({ type: SoundIOMessageType.STOP_PLAYBACK, requestId: this.__nextRequestId++ });
  }

  /** Requests permission to use the host's default microphone. */
  async requestMicPermission(): Promise<boolean> {
    const requestId = this.__nextRequestId++;
    const response = await this.__request(
      { type: SoundIOMessageType.REQUEST_MIC_PERMISSION, requestId },
      [],
      (msg, id): msg is Extract<SoundIOMessage, { type: SoundIOMessageType.MIC_PERMISSION_RESULT }> =>
        msg.type === SoundIOMessageType.MIC_PERMISSION_RESULT && msg.requestId === id,
      (_msg, _id): _msg is never => false,
    );
    return response.granted;
  }

  /** Starts recording from the microphone, resolving once recording has actually begun. */
  async startRecording(): Promise<void> {
    const requestId = this.__nextRequestId++;
    await this.__request(
      { type: SoundIOMessageType.START_RECORDING, requestId },
      [],
      (msg, id): msg is Extract<SoundIOMessage, { type: SoundIOMessageType.RECORDING_STARTED }> =>
        msg.type === SoundIOMessageType.RECORDING_STARTED && msg.requestId === id,
      (msg, id): msg is Extract<SoundIOMessage, { type: SoundIOMessageType.RECORDING_ERROR }> =>
        msg.type === SoundIOMessageType.RECORDING_ERROR && msg.requestId === id,
    );
  }

  /** Stops the current recording, resolving with the recorded samples. */
  async stopRecording(): Promise<{ samples: Float32Array; sampleRate: number }> {
    const requestId = this.__nextRequestId++;
    const response = await this.__request(
      { type: SoundIOMessageType.STOP_RECORDING, requestId },
      [],
      (msg, id): msg is Extract<SoundIOMessage, { type: SoundIOMessageType.RECORDING_RESULT }> =>
        msg.type === SoundIOMessageType.RECORDING_RESULT && msg.requestId === id,
      (msg, id): msg is Extract<SoundIOMessage, { type: SoundIOMessageType.RECORDING_ERROR }> =>
        msg.type === SoundIOMessageType.RECORDING_ERROR && msg.requestId === id,
    );
    return { samples: response.samples, sampleRate: response.sampleRate };
  }
}
checkIsPluginClass(SoundIORunnerPlugin);
