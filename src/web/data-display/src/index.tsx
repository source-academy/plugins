
import type { ITabService } from '@sourceacademy/common-tabs';
import { checkIsPluginClass, type IChannel, type IConduit, type IPlugin } from '@sourceacademy/conductor/conduit';
import makeDataVisualizerTabFrom from './SideContentDataVisualizer';
import DataVisualizer from './dataVisualizer';
import { CHANNEL_ID, WEB_ID, type Data } from '@sourceacademy/common-data-display';
import type { Data as SerialisedData } from './dataVisualizerTypes';
function serialiseData(data: Data): SerialisedData {
  const objCache: Map<Data, SerialisedData> = new Map();
  function helper(data: Data): SerialisedData {
    if (objCache.has(data)) {
      return objCache.get(data);
    }
    objCache.set(data, []);
    switch (data.type) {
      case "array":
        (objCache.get(data) as Data[]).push(...data.value.map(helper))
        break;
      case "function":
        objCache.set(data, () => { })
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
  static channelAttach = [CHANNEL_ID];

  private __dataChannel: IChannel<Data>;

  constructor(conduit: IConduit, [channel]: IChannel<any>[], tabService: ITabService) {
    this.__dataChannel = channel;
    this.__dataChannel.subscribe((data) => {
      const tab = makeDataVisualizerTabFrom('playground');
      tabService.registerTab(tab);
      tabService.showTab(tab.id);
      DataVisualizer.drawData([ serialiseData(data) ]);
    });
  }
}
