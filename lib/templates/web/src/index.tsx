import {
  type IPlugin,
  type IChannel,
  type IConduit,
  checkIsPluginClass,
} from "@sourceacademy/conductor/conduit";
import type { ITabService, Tab } from "@sourceacademy/common-tabs";

export abstract class PluginName implements IPlugin {
  readonly id: string = "__plugin_id";
  static readonly channelAttach = ["__channel_id"];
  private readonly __testChannel: IChannel<string>;
  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [testChannel]: IChannel<any>[],
    tabService: ITabService,
  ) {
    this.__testChannel = testChannel;
    this.__testChannel.subscribe(message => {
      console.log(message);
    });
    this.__testChannel.send("ping");
    const tab = {
      id: "test-tab",
      iconName: "airplane",
      body: <div></div>,
      label: "Test Tab",
      disabled: false,
    } satisfies Tab;
    tabService.registerTab(tab);
    tabService.showTab(tab.id);
  }
}
checkIsPluginClass(PluginName);
