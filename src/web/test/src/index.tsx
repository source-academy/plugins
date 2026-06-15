import { CHANNEL_ID, WEB_ID, type TestMessage } from "@sourceacademy/common-test";
import {
  type IPlugin,
  type IChannel,
  type IConduit,
  checkIsPluginClass,
} from "@sourceacademy/conductor/conduit";
import type { ITabService, Tab } from "@sourceacademy/common-tabs";

@checkIsPluginClass
export abstract class TestPlugin implements IPlugin {
  readonly id: string = WEB_ID;
  static readonly channelAttach = [CHANNEL_ID];
  private readonly __testChannel: IChannel<TestMessage>;
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
      body: (
        <div>
          This is a test tab
          <button onClick={() => tabService.hideTab(tab.id)}>Click here to hide the tab!</button>
        </div>
      ),
      label: "Test Tab",
      disabled: false,
    } satisfies Tab;
    tabService.registerTab(tab);
    tabService.showTab(tab.id);
  }
}
