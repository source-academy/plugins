import type { IConduit, IPlugin, IChannel } from "@sourceacademy/conductor/conduit";
import type { PluginClass } from "@sourceacademy/conductor/conduit";

class DirectChannel<T> implements IChannel<T> {
  readonly name: string;
  private subscribers: ((msg: T) => void)[] = [];

  constructor(name: string) {
    this.name = name;
  }

  send(message: T): void {
    this.subscribers.forEach(sub => sub(message));
  }

  subscribe(subscriber: (msg: T) => void): void {
    this.subscribers.push(subscriber);
  }

  unsubscribe(subscriber: (msg: T) => void): void {
    this.subscribers = this.subscribers.filter(s => s !== subscriber);
  }

  close(): void {
    this.subscribers = [];
  }
}

export class RemoteExecutionConduit implements IConduit {
  private channels: Map<string, DirectChannel<any>> = new Map();
  private plugins: Map<string, IPlugin> = new Map();

  registerPlugin<Arg extends any[], T extends IPlugin>(
    pluginClass: PluginClass<Arg, T>,
    ...arg: Arg
  ): T {
    const channels = pluginClass.channelAttach.map(name => {
      if (!this.channels.has(name)) {
        this.channels.set(name, new DirectChannel(name));
      }
      return this.channels.get(name)!;
    });

    const plugin = new pluginClass(this, channels, ...arg);
    if (plugin.id) this.plugins.set(plugin.id, plugin);
    return plugin;
  }

  unregisterPlugin(plugin: IPlugin): void {
    if (plugin.id) this.plugins.delete(plugin.id);
    plugin.destroy?.();
  }

  lookupPlugin(pluginId: string): IPlugin {
    if (!this.plugins.has(pluginId)) throw new Error(`Plugin ${pluginId} not found`);
    return this.plugins.get(pluginId)!;
  }

  terminate(): void {
    this.plugins.forEach(p => p.destroy?.());
    this.channels.forEach(c => c.close());
    this.plugins.clear();
    this.channels.clear();
  }
}