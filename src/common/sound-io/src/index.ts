export const RUNNER_ID = "__runner_sound_io";
export const WEB_ID = "__web_sound_io";

export const CHANNEL_ID = "sound_io";

export enum SoundIOMessageType {
  PLAY_SAMPLES = "play_samples",
  PLAYBACK_ENDED = "playback_ended",
  PLAYBACK_ERROR = "playback_error",
  STOP_PLAYBACK = "stop_playback",
  REQUEST_MIC_PERMISSION = "request_mic_permission",
  MIC_PERMISSION_RESULT = "mic_permission_result",
  START_RECORDING = "start_recording",
  RECORDING_STARTED = "recording_started",
  RECORDING_ERROR = "recording_error",
  STOP_RECORDING = "stop_recording",
  RECORDING_RESULT = "recording_result",
}

/**
 * Every request/response pair is correlated by `requestId`, a counter incremented by the runner
 * side. This allows overlapping requests to resolve correctly rather than assuming only one
 * in-flight request at a time.
 */
export type SoundIOMessage =
  | { type: SoundIOMessageType.PLAY_SAMPLES; requestId: number; samples: Float32Array; sampleRate: number }
  | { type: SoundIOMessageType.PLAYBACK_ENDED; requestId: number }
  | { type: SoundIOMessageType.PLAYBACK_ERROR; requestId: number; error: string }
  | { type: SoundIOMessageType.STOP_PLAYBACK; requestId: number }
  | { type: SoundIOMessageType.REQUEST_MIC_PERMISSION; requestId: number }
  | { type: SoundIOMessageType.MIC_PERMISSION_RESULT; requestId: number; granted: boolean }
  | { type: SoundIOMessageType.START_RECORDING; requestId: number }
  | { type: SoundIOMessageType.RECORDING_STARTED; requestId: number }
  | { type: SoundIOMessageType.RECORDING_ERROR; requestId: number; error: string }
  | { type: SoundIOMessageType.STOP_RECORDING; requestId: number }
  | { type: SoundIOMessageType.RECORDING_RESULT; requestId: number; samples: Float32Array; sampleRate: number };
