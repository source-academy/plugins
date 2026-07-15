import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import { SoundIORunnerPlugin } from "..";
import { CHANNEL_ID, RUNNER_ID, SoundIOMessageType, type SoundIOMessage } from "@sourceacademy/common-sound-io";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";

type ChannelSubscriber = (msg: SoundIOMessage) => void | Promise<void>;

type TestChannel = IChannel<SoundIOMessage> & {
  send: Mock<(msg: SoundIOMessage, transfer?: Transferable[]) => void>;
  subscribe: Mock<(handler: ChannelSubscriber) => void>;
  unsubscribe: Mock<(handler: ChannelSubscriber) => void>;
};

const makeChannel = (getResponse?: (msg: SoundIOMessage) => SoundIOMessage | undefined): TestChannel => {
  let subscriber: ChannelSubscriber | undefined;
  const send = vi.fn((msg: SoundIOMessage) => {
    const response = getResponse?.(msg);
    if (response) {
      queueMicrotask(() => subscriber?.(response));
    }
  });
  const subscribe = vi.fn((handler: ChannelSubscriber) => {
    subscriber = handler;
  });
  const unsubscribe = vi.fn((handler: ChannelSubscriber) => {
    if (subscriber === handler) subscriber = undefined;
  });
  return { name: CHANNEL_ID, send, subscribe, unsubscribe, close: vi.fn() };
};

const makePlugin = (channel = makeChannel()) => {
  const plugin = new SoundIORunnerPlugin({} as IConduit, [channel]);
  return { plugin, channel };
};

afterEach(() => {
  SoundIORunnerPlugin.instance = null;
});

describe("plugin identity", () => {
  test("id is RUNNER_ID", () => {
    expect(makePlugin().plugin.id).toBe(RUNNER_ID);
  });

  test("channelAttach declares the sound_io channel", () => {
    expect(SoundIORunnerPlugin.channelAttach).toEqual([CHANNEL_ID]);
  });

  test("constructor sets the singleton instance", () => {
    const { plugin } = makePlugin();
    expect(SoundIORunnerPlugin.instance).toBe(plugin);
  });
});

describe("playSamples", () => {
  test("sends PLAY_SAMPLES with the samples buffer transferred, resolves on PLAYBACK_ENDED", async () => {
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.PLAY_SAMPLES
        ? { type: SoundIOMessageType.PLAYBACK_ENDED, requestId: msg.requestId }
        : undefined,
    );
    const { plugin } = makePlugin(channel);
    const samples = new Float32Array([0.1, 0.2, 0.3]);

    await expect(plugin.playSamples(samples, 44100)).resolves.toBeUndefined();

    expect(channel.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: SoundIOMessageType.PLAY_SAMPLES, samples, sampleRate: 44100 }),
      [samples.buffer],
    );
    expect(channel.unsubscribe).toHaveBeenCalledOnce();
  });

  test("rejects on PLAYBACK_ERROR", async () => {
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.PLAY_SAMPLES
        ? { type: SoundIOMessageType.PLAYBACK_ERROR, requestId: msg.requestId, error: "no audio device" }
        : undefined,
    );
    const { plugin } = makePlugin(channel);

    await expect(plugin.playSamples(new Float32Array([0]), 44100)).rejects.toThrow("no audio device");
  });

  test("ignores responses for a different requestId", async () => {
    const responses: SoundIOMessage[] = [];
    const channel = makeChannel(msg => {
      if (msg.type !== SoundIOMessageType.PLAY_SAMPLES) return undefined;
      responses.push({ type: SoundIOMessageType.PLAYBACK_ENDED, requestId: msg.requestId + 999 });
      return { type: SoundIOMessageType.PLAYBACK_ENDED, requestId: msg.requestId };
    });
    const { plugin } = makePlugin(channel);
    await expect(plugin.playSamples(new Float32Array([0]), 44100)).resolves.toBeUndefined();
  });
});

describe("stopPlayback", () => {
  test("sends STOP_PLAYBACK", () => {
    const { plugin, channel } = makePlugin();
    plugin.stopPlayback();
    expect(channel.send).toHaveBeenCalledWith(
      expect.objectContaining({ type: SoundIOMessageType.STOP_PLAYBACK }),
    );
  });
});

describe("requestMicPermission", () => {
  test("resolves true when granted", async () => {
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.REQUEST_MIC_PERMISSION
        ? { type: SoundIOMessageType.MIC_PERMISSION_RESULT, requestId: msg.requestId, granted: true }
        : undefined,
    );
    const { plugin } = makePlugin(channel);
    await expect(plugin.requestMicPermission()).resolves.toBe(true);
  });

  test("resolves false when denied", async () => {
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.REQUEST_MIC_PERMISSION
        ? { type: SoundIOMessageType.MIC_PERMISSION_RESULT, requestId: msg.requestId, granted: false }
        : undefined,
    );
    const { plugin } = makePlugin(channel);
    await expect(plugin.requestMicPermission()).resolves.toBe(false);
  });
});

describe("startRecording / stopRecording", () => {
  test("startRecording resolves once RECORDING_STARTED is received", async () => {
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.START_RECORDING
        ? { type: SoundIOMessageType.RECORDING_STARTED, requestId: msg.requestId }
        : undefined,
    );
    const { plugin } = makePlugin(channel);
    await expect(plugin.startRecording()).resolves.toBeUndefined();
  });

  test("startRecording rejects on RECORDING_ERROR", async () => {
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.START_RECORDING
        ? { type: SoundIOMessageType.RECORDING_ERROR, requestId: msg.requestId, error: "mic denied" }
        : undefined,
    );
    const { plugin } = makePlugin(channel);
    await expect(plugin.startRecording()).rejects.toThrow("mic denied");
  });

  test("stopRecording resolves with the recorded samples", async () => {
    const samples = new Float32Array([0.4, 0.5]);
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.STOP_RECORDING
        ? { type: SoundIOMessageType.RECORDING_RESULT, requestId: msg.requestId, samples, sampleRate: 48000 }
        : undefined,
    );
    const { plugin } = makePlugin(channel);
    await expect(plugin.stopRecording()).resolves.toEqual({ samples, sampleRate: 48000 });
  });

  test("stopRecording rejects on RECORDING_ERROR", async () => {
    const channel = makeChannel(msg =>
      msg.type === SoundIOMessageType.STOP_RECORDING
        ? { type: SoundIOMessageType.RECORDING_ERROR, requestId: msg.requestId, error: "nothing recording" }
        : undefined,
    );
    const { plugin } = makePlugin(channel);
    await expect(plugin.stopRecording()).rejects.toThrow("nothing recording");
  });
});
