import {
  CHANNEL_ID,
  ModuleLoaderMessageType,
  RUNNER_ID,
  type ModuleLoaderMessage,
} from "@sourceacademy/common-module-loader";
import {
  checkIsPluginClass,
  type IChannel,
  type IConduit,
  type IPlugin,
} from "@sourceacademy/conductor/conduit";
import type { IModulePlugin } from "@sourceacademy/conductor/module";
import type { IInterfacableEvaluator, IRunnerPlugin } from "@sourceacademy/conductor/runner";

export class ModuleLoaderRunnerPlugin implements IPlugin {
  readonly id: string = RUNNER_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __moduleRequestChannel: IChannel<ModuleLoaderMessage>;
  private readonly __conductor: IRunnerPlugin;
  private readonly __evaluator: IInterfacableEvaluator;
  static instance: ModuleLoaderRunnerPlugin | null = null;
  constructor(
    conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [moduleRequestChannel]: IChannel<any>[],
    conductor: IRunnerPlugin,
    evaluator: IInterfacableEvaluator,
  ) {
    this.__moduleRequestChannel = moduleRequestChannel;
    this.__conductor = conductor;
    this.__evaluator = evaluator;
    ModuleLoaderRunnerPlugin.instance = this;
  }
  async requestModule(moduleName: string): Promise<IModulePlugin> {
    return new Promise((resolve, reject) => {
      const handleResponse = async (msg: ModuleLoaderMessage) => {
        this.__moduleRequestChannel.unsubscribe(handleResponse);
        if (msg.type === ModuleLoaderMessageType.MODULE_RESPONSE) {
          const plugin = await import(msg.moduleURL).then(module => {
            return module.default(() => {}).default;
          });
          const pluginObj = this.__conductor.registerPlugin(plugin, this.__evaluator, {
            tabs: msg.tabs,
            loadTab: (tabName: string) => {
              if (!msg.tabs.includes(tabName)) {
                throw new Error(`Tab ${tabName} not found in module ${moduleName}`);
              }
              this.__conductor.hostLoadPlugin(tabName);
            },
          }) as IModulePlugin;
          await pluginObj?.initialise();
          resolve(pluginObj);
        } else if (msg.type === ModuleLoaderMessageType.MODULE_ERROR) {
          reject(new Error(msg.error));
        }
      };
      this.__moduleRequestChannel.subscribe(handleResponse);
      this.__moduleRequestChannel.send({
        type: ModuleLoaderMessageType.REQUEST_MODULE,
        moduleName,
      });
    });
  }
}
checkIsPluginClass(ModuleLoaderRunnerPlugin);
