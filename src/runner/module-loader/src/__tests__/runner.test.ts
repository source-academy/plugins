import { afterEach, describe, expect, test, vi, type Mock, type MockedFunction } from "vitest";
import { ModuleLoaderRunnerPlugin } from "..";
import {
  CHANNEL_ID,
  ModuleLoaderMessageType,
  RUNNER_ID,
  type ModuleLoaderMessage,
} from "@sourceacademy/common-module-loader";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import type { IModulePlugin } from "@sourceacademy/conductor/module";
import type { IInterfacableEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";
import type { PluginClass } from "@sourceacademy/conductor/conduit";
type ChannelSubscriber = (msg: ModuleLoaderMessage) => void | Promise<void>;

type TestChannel = IChannel<ModuleLoaderMessage> & {
  send: Mock<(msg: ModuleLoaderMessage) => void>;
  subscribe: Mock<(handler: ChannelSubscriber) => void>;
  unsubscribe: Mock<(handler: ChannelSubscriber) => void>;
};

const mockBundleURL = `data:text/javascript;charset=utf-8,${encodeURIComponent(`
class MockModulePlugin {}
export default () => ({ default: MockModulePlugin });
`)}`;

const makeChannel = (
  getResponse?: (msg: ModuleLoaderMessage) => ModuleLoaderMessage | undefined,
): TestChannel => {
  let subscriber: ChannelSubscriber | undefined;
  const send = vi.fn((msg: ModuleLoaderMessage) => {
    const response = getResponse?.(msg);
    if (response) {
      queueMicrotask(() => subscriber?.(response));
    }
  });
  const subscribe = vi.fn((handler: ChannelSubscriber) => {
    subscriber = handler;
  });
  const unsubscribe = vi.fn((handler: ChannelSubscriber) => {
    if (subscriber === handler) {
      subscriber = undefined;
    }
  });
  return {
    name: CHANNEL_ID,
    send,
    subscribe,
    unsubscribe,
    close: vi.fn(),
  };
};

const makeConductor = () => {
  const initialise = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const pluginObj = { initialise } as unknown as IModulePlugin;
  const registerPlugin: MockedFunction<
    (
      pluginClass: PluginClass<unknown[]>,
      evaluator: IInterfacableEvaluator,
      options: { tabs: string[]; loadTab: (tabName: string) => void },
    ) => IModulePlugin
  > = vi.fn(() => pluginObj);
  const hostLoadPlugin = vi.fn();
  const conductor = {
    registerPlugin,
    hostLoadPlugin,
  } as unknown as IRunnerPlugin;
  return { conductor, registerPlugin, hostLoadPlugin, initialise, pluginObj };
};

const makePlugin = (channel = makeChannel()) => {
  const evaluator = {} as IInterfacableEvaluator;
  const { conductor, registerPlugin, hostLoadPlugin, initialise, pluginObj } = makeConductor();
  const plugin = new ModuleLoaderRunnerPlugin({} as IConduit, [channel], conductor, evaluator);
  return {
    plugin,
    channel,
    evaluator,
    registerPlugin,
    hostLoadPlugin,
    initialise,
    pluginObj,
  };
};

afterEach(() => {
  ModuleLoaderRunnerPlugin.instance = null;
});

describe("plugin identity", () => {
  test("id is RUNNER_ID", () => {
    expect(makePlugin().plugin.id).toBe(RUNNER_ID);
  });

  test("channelAttach declares the module loader channel", () => {
    expect(ModuleLoaderRunnerPlugin.channelAttach).toEqual([CHANNEL_ID]);
  });

  test("constructor sets the singleton instance", () => {
    const { plugin } = makePlugin();
    expect(ModuleLoaderRunnerPlugin.instance).toBe(plugin);
  });
});

describe("requestModule", () => {
  test("requests a module, imports the returned bundle, registers it, and initialises it", async () => {
    const tabs = ["ChartTab", "SettingsTab"];
    const channel = makeChannel(msg => {
      if (msg.type !== ModuleLoaderMessageType.REQUEST_MODULE) {
        return undefined;
      }
      return {
        type: ModuleLoaderMessageType.MODULE_RESPONSE,
        moduleName: msg.moduleName,
        moduleURL: mockBundleURL,
        tabs,
      };
    });
    const { plugin, evaluator, registerPlugin, initialise, pluginObj } = makePlugin(channel);

    await expect(plugin.requestModule("chart")).resolves.toBe(pluginObj);

    expect(channel.subscribe).toHaveBeenCalledOnce();
    expect(channel.send).toHaveBeenCalledWith({
      type: ModuleLoaderMessageType.REQUEST_MODULE,
      moduleName: "chart",
    });
    expect(channel.unsubscribe).toHaveBeenCalledOnce();
    expect(registerPlugin).toHaveBeenCalledOnce();
    const [pluginClass, receivedEvaluator, options] = registerPlugin.mock.calls[0];
    expect(pluginClass).toEqual(expect.any(Function));
    expect(pluginClass.name).toBe("MockModulePlugin");
    expect(receivedEvaluator).toBe(evaluator);
    expect(options).toMatchObject({ tabs });
    expect(initialise).toHaveBeenCalledOnce();
  });

  test("loadTab delegates to the conductor for declared tabs only", async () => {
    const channel = makeChannel(msg => {
      if (msg.type !== ModuleLoaderMessageType.REQUEST_MODULE) {
        return undefined;
      }
      return {
        type: ModuleLoaderMessageType.MODULE_RESPONSE,
        moduleName: msg.moduleName,
        moduleURL: mockBundleURL,
        tabs: ["ChartTab"],
      };
    });
    const { plugin, registerPlugin, hostLoadPlugin } = makePlugin(channel);

    await plugin.requestModule("chart");
    const options = registerPlugin.mock.calls[0][2];

    options.loadTab("ChartTab");
    expect(hostLoadPlugin).toHaveBeenCalledWith("ChartTab");
    expect(() => options.loadTab("MissingTab")).toThrow("Tab MissingTab not found in module chart");
  });

  test("rejects when the mocked web side returns a module error", async () => {
    const channel = makeChannel(msg => {
      if (msg.type !== ModuleLoaderMessageType.REQUEST_MODULE) {
        return undefined;
      }
      return {
        type: ModuleLoaderMessageType.MODULE_ERROR,
        moduleName: msg.moduleName,
        error: "Module not found: missing",
      };
    });
    const { plugin, registerPlugin } = makePlugin(channel);

    await expect(plugin.requestModule("missing")).rejects.toThrow("Module not found: missing");
    expect(channel.unsubscribe).toHaveBeenCalledOnce();
    expect(registerPlugin).not.toHaveBeenCalled();
  });
});
