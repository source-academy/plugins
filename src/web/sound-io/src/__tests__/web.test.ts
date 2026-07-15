import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { SoundIOWebPlugin } from "..";
import { CHANNEL_ID, SoundIOMessageType, WEB_ID, type SoundIOMessage } from "@sourceacademy/common-sound-io";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";

type ChannelSubscriber = (msg: SoundIOMessage) => void;

type TestChannel = IChannel<SoundIOMessage> & {
  send: Mock<(msg: SoundIOMessage, transfer?: Transferable[]) => void>;
  emit: (msg: SoundIOMessage) => void;
};

const makeChannel = (): TestChannel => {
  let subscriber: ChannelSubscriber | undefined;
  const send = vi.fn<(msg: SoundIOMessage, transfer?: Transferable[]) => void>();
  const subscribe = vi.fn((handler: ChannelSubscriber) => {
    subscriber = handler;
  });
  const emit = (msg: SoundIOMessage) => subscriber?.(msg);
  return { name: CHANNEL_ID, send, subscribe, unsubscribe: vi.fn(), close: vi.fn(), emit };
};

class FakeAudioBufferSourceNode {
  buffer: unknown = null;
  onended: (() => void) | null = null;
  connect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());
}

class FakeAudioBuffer {
  readonly sampleRate: number;
  private readonly channelData: Float32Array;
  constructor(_channels: number, length: number, sampleRate: number) {
    this.sampleRate = sampleRate;
    this.channelData = new Float32Array(length);
  }
  getChannelData() {
    return this.channelData;
  }
}

class FakeAudioContext {
  destination = {};
  sampleRate = 44100;
  createBuffer = vi.fn((channels: number, length: number, sampleRate: number) => new FakeAudioBuffer(channels, length, sampleRate));
  createBufferSource = vi.fn(() => new FakeAudioBufferSourceNode());
  decodeAudioData = vi.fn((_buf: ArrayBuffer) => Promise.resolve(new FakeAudioBuffer(1, 4, 48000)));
}

const makePlugin = (channel = makeChannel()) => {
  const plugin = new SoundIOWebPlugin({} as IConduit, [channel]);
  return { plugin, channel };
};

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);
});

afterEach(() => {
  vi.unstubAllGlobals();
  SoundIOWebPlugin.instance = null;
});

describe("plugin identity", () => {
  test("id is WEB_ID", () => {
    expect(makePlugin().plugin.id).toBe(WEB_ID);
  });

  test("channelAttach declares the sound_io channel", () => {
    expect(SoundIOWebPlugin.channelAttach).toEqual([CHANNEL_ID]);
  });
});

describe("PLAY_SAMPLES", () => {
  test("plays the samples and reports PLAYBACK_ENDED once the source ends", () => {
    const audioContext = new FakeAudioContext();
    vi.stubGlobal(
      "AudioContext",
      vi.fn(function () {
        return audioContext;
      }),
    );
    const { channel } = makePlugin();
    const samples = new Float32Array([0.1, 0.2]);
    channel.emit({ type: SoundIOMessageType.PLAY_SAMPLES, requestId: 1, samples, sampleRate: 44100 });

    expect(channel.send).not.toHaveBeenCalled();
    // Simulate the source finishing playback (real AudioBufferSourceNodes fire this on their own).
    audioContext.createBufferSource.mock.results[0].value.onended();

    expect(channel.send).toHaveBeenCalledWith({ type: SoundIOMessageType.PLAYBACK_ENDED, requestId: 1 });
  });

  test("STOP_PLAYBACK stops the current source, which triggers PLAYBACK_ENDED", () => {
    const { plugin, channel } = makePlugin();
    const samples = new Float32Array([0.1, 0.2]);
    channel.emit({ type: SoundIOMessageType.PLAY_SAMPLES, requestId: 1, samples, sampleRate: 44100 });
    channel.send.mockClear();

    channel.emit({ type: SoundIOMessageType.STOP_PLAYBACK, requestId: 2 });
    expect(channel.send).toHaveBeenCalledWith({ type: SoundIOMessageType.PLAYBACK_ENDED, requestId: 1 });
    void plugin;
  });

  test("reports PLAYBACK_ERROR if creating the audio context throws", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("no audio device");
        }
      },
    );
    const { channel } = makePlugin();
    channel.emit({ type: SoundIOMessageType.PLAY_SAMPLES, requestId: 1, samples: new Float32Array([0]), sampleRate: 44100 });

    expect(channel.send).toHaveBeenCalledWith({
      type: SoundIOMessageType.PLAYBACK_ERROR,
      requestId: 1,
      error: "no audio device",
    });
  });
});

describe("microphone permission and recording", () => {
  test("REQUEST_MIC_PERMISSION reports granted: true on success", async () => {
    const getUserMedia = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const { channel } = makePlugin();

    channel.emit({ type: SoundIOMessageType.REQUEST_MIC_PERMISSION, requestId: 1 });
    await vi.waitFor(() => {
      expect(channel.send).toHaveBeenCalledWith({
        type: SoundIOMessageType.MIC_PERMISSION_RESULT,
        requestId: 1,
        granted: true,
      });
    });
  });

  test("REQUEST_MIC_PERMISSION reports granted: false on rejection", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const { channel } = makePlugin();

    channel.emit({ type: SoundIOMessageType.REQUEST_MIC_PERMISSION, requestId: 1 });
    await vi.waitFor(() => {
      expect(channel.send).toHaveBeenCalledWith({
        type: SoundIOMessageType.MIC_PERMISSION_RESULT,
        requestId: 1,
        granted: false,
      });
    });
  });

  test("STOP_RECORDING with nothing recording reports RECORDING_ERROR", () => {
    const { channel } = makePlugin();
    channel.emit({ type: SoundIOMessageType.STOP_RECORDING, requestId: 5 });

    expect(channel.send).toHaveBeenCalledWith({
      type: SoundIOMessageType.RECORDING_ERROR,
      requestId: 5,
      error: "No recording in progress",
    });
  });

  test("START_RECORDING then STOP_RECORDING reports RECORDING_RESULT with decoded samples", async () => {
    class FakeMediaRecorder {
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      mimeType = "audio/webm";
      start = vi.fn(() => {
        this.ondataavailable?.({ data: new Blob(["chunk"], { type: this.mimeType }) });
      });
      stop = vi.fn(() => this.onstop?.());
    }
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
    const getUserMedia = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });

    const { channel } = makePlugin();
    channel.emit({ type: SoundIOMessageType.START_RECORDING, requestId: 1 });
    await vi.waitFor(() => {
      expect(channel.send).toHaveBeenCalledWith({ type: SoundIOMessageType.RECORDING_STARTED, requestId: 1 });
    });

    channel.emit({ type: SoundIOMessageType.STOP_RECORDING, requestId: 2 });
    await vi.waitFor(() => {
      expect(channel.send).toHaveBeenCalledWith(
        expect.objectContaining({ type: SoundIOMessageType.RECORDING_RESULT, requestId: 2, sampleRate: 48000 }),
        [expect.anything()],
      );
    });
  });
});
