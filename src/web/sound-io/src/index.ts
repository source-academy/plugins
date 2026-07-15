import {
  CHANNEL_ID,
  SoundIOMessageType,
  WEB_ID,
  type SoundIOMessage,
} from "@sourceacademy/common-sound-io";
import { checkIsPluginClass, type IChannel, type IConduit, type IPlugin } from "@sourceacademy/conductor/conduit";

/**
 * Web-side host plugin doing the actual audio I/O (Web Audio playback, MediaRecorder-based
 * recording). This exists because the runner executes inside a Worker, which has no access to
 * AudioContext output or getUserMedia/MediaRecorder; the runner side
 * (@sourceacademy/runner-sound-io) sends requests here over a shared channel instead.
 */
export class SoundIOWebPlugin implements IPlugin {
  readonly id: string = WEB_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __channel: IChannel<SoundIOMessage>;

  static instance: SoundIOWebPlugin | null = null;

  private __audioContext: AudioContext | null = null;
  private __currentSource: AudioBufferSourceNode | null = null;
  private __micStream: MediaStream | null = null;
  private __mediaRecorder: MediaRecorder | null = null;
  private __recordedChunks: Blob[] = [];

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [channel]: IChannel<any>[],
  ) {
    this.__channel = channel;
    SoundIOWebPlugin.instance = this;
    this.__channel.subscribe(message => this.__handleMessage(message));
  }

  private __getAudioContext(): AudioContext {
    if (!this.__audioContext) {
      this.__audioContext = new AudioContext();
    }
    return this.__audioContext;
  }

  private __handleMessage(message: SoundIOMessage): void {
    switch (message.type) {
      case SoundIOMessageType.PLAY_SAMPLES:
        this.__playSamples(message.requestId, message.samples, message.sampleRate);
        return;
      case SoundIOMessageType.STOP_PLAYBACK:
        this.__stopPlayback();
        return;
      case SoundIOMessageType.REQUEST_MIC_PERMISSION:
        this.__requestMicPermission(message.requestId);
        return;
      case SoundIOMessageType.START_RECORDING:
        this.__startRecording(message.requestId);
        return;
      case SoundIOMessageType.STOP_RECORDING:
        this.__stopRecording(message.requestId);
        return;
      default:
        return;
    }
  }

  private __playSamples(requestId: number, samples: Float32Array, sampleRate: number): void {
    try {
      const audioContext = this.__getAudioContext();
      const buffer = audioContext.createBuffer(1, samples.length, sampleRate);
      buffer.getChannelData(0).set(samples);

      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      this.__currentSource = source;
      source.onended = () => {
        if (this.__currentSource === source) {
          this.__currentSource = null;
        }
        this.__channel.send({ type: SoundIOMessageType.PLAYBACK_ENDED, requestId });
      };
      source.start();
    } catch (error) {
      this.__channel.send({
        type: SoundIOMessageType.PLAYBACK_ERROR,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private __stopPlayback(): void {
    this.__currentSource?.stop();
  }

  private async __requestMicPermission(requestId: number): Promise<void> {
    try {
      this.__micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.__channel.send({ type: SoundIOMessageType.MIC_PERMISSION_RESULT, requestId, granted: true });
    } catch {
      this.__micStream = null;
      this.__channel.send({ type: SoundIOMessageType.MIC_PERMISSION_RESULT, requestId, granted: false });
    }
  }

  private async __startRecording(requestId: number): Promise<void> {
    try {
      if (!this.__micStream) {
        this.__micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      this.__recordedChunks = [];
      const mediaRecorder = new MediaRecorder(this.__micStream);
      mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) this.__recordedChunks.push(event.data);
      };
      this.__mediaRecorder = mediaRecorder;
      mediaRecorder.start();
      this.__channel.send({ type: SoundIOMessageType.RECORDING_STARTED, requestId });
    } catch (error) {
      this.__channel.send({
        type: SoundIOMessageType.RECORDING_ERROR,
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private __stopRecording(requestId: number): void {
    const mediaRecorder = this.__mediaRecorder;
    if (!mediaRecorder) {
      this.__channel.send({
        type: SoundIOMessageType.RECORDING_ERROR,
        requestId,
        error: "No recording in progress",
      });
      return;
    }
    mediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(this.__recordedChunks, { type: mediaRecorder.mimeType });
        const arrayBuffer = await blob.arrayBuffer();
        const audioContext = this.__getAudioContext();
        const decoded = await audioContext.decodeAudioData(arrayBuffer);
        const samples = new Float32Array(decoded.getChannelData(0));
        this.__channel.send(
          { type: SoundIOMessageType.RECORDING_RESULT, requestId, samples, sampleRate: decoded.sampleRate },
          [samples.buffer],
        );
      } catch (error) {
        this.__channel.send({
          type: SoundIOMessageType.RECORDING_ERROR,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    mediaRecorder.stop();
    this.__mediaRecorder = null;
  }
}
checkIsPluginClass(SoundIOWebPlugin);
