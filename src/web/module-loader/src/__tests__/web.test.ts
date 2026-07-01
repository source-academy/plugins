import { afterEach, describe, expect, test, vi, type Mock } from "vitest";
import { ModuleLoaderWebPlugin } from "..";
import {
  CHANNEL_ID,
  ModuleLoaderMessageType,
  WEB_ID,
  type ModuleLoaderMessage,
} from "@sourceacademy/common-module-loader";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";

type ModuleDirectory = Record<string, { tabs: string[] }>;
type ChannelSubscriber = (msg: ModuleLoaderMessage) => void;

type TestChannel = IChannel<ModuleLoaderMessage> & {
  send: Mock<(msg: ModuleLoaderMessage) => void>;
  subscribe: Mock<(handler: ChannelSubscriber) => void>;
  emit: (msg: ModuleLoaderMessage) => void;
};

const moduleDirectoryURL = "/mock/modules.json";
const moduleDirectory: ModuleDirectory = {
  chart: { tabs: ["ChartTab", "SettingsTab"] },
  "!!!": { tabs: [] },
};

const makeChannel = (): TestChannel => {
  let subscriber: ChannelSubscriber | undefined;
  const send = vi.fn<(msg: ModuleLoaderMessage) => void>();
  const subscribe = vi.fn((handler: ChannelSubscriber) => {
    subscriber = handler;
  });
  const emit = (msg: ModuleLoaderMessage) => subscriber?.(msg);
  return {
    name: CHANNEL_ID,
    send,
    subscribe,
    unsubscribe: vi.fn(),
    close: vi.fn(),
    emit,
  };
};

const makePlugin = (channel = makeChannel()) => {
  const plugin = new ModuleLoaderWebPlugin({} as IConduit, [channel]);
  return { plugin, channel };
};

const mockFetch = (directory = moduleDirectory) => {
  const json = vi.fn().mockResolvedValue(directory);
  const fetch = vi.fn().mockResolvedValue({ json });
  vi.stubGlobal("fetch", fetch);
  return { fetch, json };
};

const loadDirectory = async (plugin: ModuleLoaderWebPlugin) => {
  plugin.onModuleDirectoryURLChange(moduleDirectoryURL);
  await vi.waitFor(() => {
    expect(plugin.getModuleTabLocation("ChartTab")).toBe("/mock/tabs/ChartTab.js");
  });
};

afterEach(() => {
  vi.unstubAllGlobals();
  ModuleLoaderWebPlugin.instance = null;
});

describe("plugin identity", () => {
  test("id is WEB_ID", () => {
    expect(makePlugin().plugin.id).toBe(WEB_ID);
  });

  test("channelAttach declares the module loader channel", () => {
    expect(ModuleLoaderWebPlugin.channelAttach).toEqual([CHANNEL_ID]);
  });

  test("constructor sets the singleton instance", () => {
    const { plugin } = makePlugin();
    expect(ModuleLoaderWebPlugin.instance).toBe(plugin);
  });
});

describe("module directory loading", () => {
  test("fetches and stores the configured module directory URL", async () => {
    const { plugin } = makePlugin();
    const { fetch, json } = mockFetch();

    await loadDirectory(plugin);

    expect(fetch).toHaveBeenCalledWith(moduleDirectoryURL);
    expect(json).toHaveBeenCalledOnce();
  });

  test("does not fetch the same loaded directory URL twice", async () => {
    const { plugin } = makePlugin();
    const { fetch } = mockFetch();

    await loadDirectory(plugin);
    plugin.onModuleDirectoryURLChange(moduleDirectoryURL);

    expect(fetch).toHaveBeenCalledOnce();
  });
});

describe("request handling", () => {
  test("returns an error when the directory has not loaded yet", () => {
    const { channel } = makePlugin();

    channel.emit({
      type: ModuleLoaderMessageType.REQUEST_MODULE,
      moduleName: "chart",
    });

    expect(channel.send).toHaveBeenCalledWith({
      type: ModuleLoaderMessageType.MODULE_ERROR,
      error: "Module directory not loaded yet",
    });
  });

  test("responds with the bundle URL and tabs for a known module", async () => {
    const { plugin, channel } = makePlugin();
    mockFetch();
    await loadDirectory(plugin);

    channel.emit({
      type: ModuleLoaderMessageType.REQUEST_MODULE,
      moduleName: "chart",
    });

    expect(channel.send).toHaveBeenCalledWith({
      type: ModuleLoaderMessageType.MODULE_RESPONSE,
      moduleURL: "/mock/bundles/chart.js",
      tabs: ["ChartTab", "SettingsTab"],
    });
  });

  test("returns an error for an unknown module", async () => {
    const { plugin, channel } = makePlugin();
    mockFetch();
    await loadDirectory(plugin);

    channel.emit({
      type: ModuleLoaderMessageType.REQUEST_MODULE,
      moduleName: "missing",
    });

    expect(channel.send).toHaveBeenCalledWith({
      type: ModuleLoaderMessageType.MODULE_ERROR,
      error: "Module not found: missing",
    });
  });

  test("returns an error for an invalid module name present in the directory", async () => {
    const { plugin, channel } = makePlugin();
    mockFetch();
    await loadDirectory(plugin);

    channel.emit({
      type: ModuleLoaderMessageType.REQUEST_MODULE,
      moduleName: "!!!",
    });

    expect(channel.send).toHaveBeenCalledWith({
      type: ModuleLoaderMessageType.MODULE_ERROR,
      error: "Invalid module name: !!!",
    });
  });

  test("ignores non-request messages", () => {
    const { channel } = makePlugin();

    channel.emit({
      type: ModuleLoaderMessageType.MODULE_RESPONSE,
      moduleURL: "/mock/bundles/chart.js",
      tabs: [],
    });

    expect(channel.send).not.toHaveBeenCalled();
  });
});

describe("tab locations", () => {
  test("returns null before the module directory has loaded", () => {
    const { plugin } = makePlugin();

    expect(plugin.getModuleTabLocation("ChartTab")).toBeNull();
  });

  test("returns tab URLs for known tabs and null for unknown tabs", async () => {
    const { plugin } = makePlugin();
    mockFetch();
    await loadDirectory(plugin);

    expect(plugin.getModuleTabLocation("ChartTab")).toBe("/mock/tabs/ChartTab.js");
    expect(plugin.getModuleTabLocation("MissingTab")).toBeNull();
  });
});
