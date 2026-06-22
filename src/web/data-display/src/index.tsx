import type { ITabService } from "@sourceacademy/common-tabs";
import {
  checkIsPluginClass,
  type IChannel,
  type IConduit,
  type IPlugin,
} from "@sourceacademy/conductor/conduit";
import makeDataVisualizerTabFrom from "./SideContentDataVisualizer";
import DataVisualizer from "./dataVisualizer";
import {
  CONFIG_CHANNEL_ID,
  DATA_CHANNEL_ID,
  WEB_ID,
  type Config,
  type Data,
} from "@sourceacademy/common-data-display";
import type { Data as SerialisedData } from "./dataVisualizerTypes";
function serialiseData(data: Data): SerialisedData {
  const objCache: Map<Data, SerialisedData> = new Map();
  function helper(data: Data): SerialisedData {
    if (objCache.has(data)) {
      return objCache.get(data);
    }
    objCache.set(data, []);
    switch (data.type) {
      case "array":
        (objCache.get(data) as Data[]).push(...data.value.map(helper));
        break;
      case "function":
        objCache.set(data, () => {});
        break;
      case "null":
        objCache.set(data, null);
        break;
      case "string":
        objCache.set(data, data.value);
        break;
    }
    return objCache.get(data);
  }
  return helper(data);
}

@checkIsPluginClass
export default class DisplayDataWebPlugin implements IPlugin {
  id = WEB_ID;
  static channelAttach = [DATA_CHANNEL_ID, CONFIG_CHANNEL_ID];

  private __dataChannel: IChannel<Data>;
  private __configChannel: IChannel<Config | null>;

  constructor(
    _conduit: IConduit,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [dataChannel, configChannel]: IChannel<any>[],
    tabService: ITabService,
  ) {
    this.__dataChannel = dataChannel;
    this.__configChannel = configChannel;
    this.__configChannel.subscribe(msg => {
      if (msg === null) return;
      const tab = makeDataVisualizerTabFrom("playground", msg);
      tabService.registerTab(tab);
      tabService.showTab(tab.id);
    });
    this.__configChannel.send(null);
    this.__dataChannel.subscribe(data => {
      DataVisualizer.drawData([serialiseData(data)]);
    });
  }
}
