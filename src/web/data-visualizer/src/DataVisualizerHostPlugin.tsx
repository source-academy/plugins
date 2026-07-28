import {
  DATA_VISUALIZER_CHANNEL_ID,
  WEB_ID,
  type DataVisualizerMessage,
  type SerializedDataVisualizerRow,
} from "@sourceacademy/common-data-visualizer";
import type { ITabService, Tab } from "@sourceacademy/common-tabs";
import {
  checkIsPluginClass,
  type IChannel,
  type IConduit,
  type IPlugin,
} from "@sourceacademy/conductor/conduit";
import { createElement, useSyncExternalStore } from "react";

import DataVisualizerView from "./DataVisualizerView";

/** The side-content tab id used by the host to show/hide the data visualizer tab. */
const TAB_ID = "data-visualizer";

/**
 * The host (browser-side) half of the data visualizer. It listens on the data visualizer channel
 * for rows pushed by the runner plugin, holds them as an external store, and contributes a
 * side-content tab (via the injected {@link ITabService}) whose body renders them.
 *
 * The plugin is entirely language-agnostic — it only knows the serialized row protocol from
 * `@sourceacademy/common-data-visualizer`, plus the standard tab-service contract from
 * `@sourceacademy/common-tabs`. Cycle/shared-structure handling and rendering (in `tree/`) lives
 * here too, shared across every language — see this package's sibling `runner-data-visualizer`
 * package for why that logic is not duplicated per language. It is loaded dynamically by the host
 * (no per-language frontend code).
 */
export class DataVisualizerHostPlugin implements IPlugin {
  static readonly channelAttach = [DATA_VISUALIZER_CHANNEL_ID];
  readonly id: string = WEB_ID;

  private readonly __channel: IChannel<DataVisualizerMessage>;
  private __rows: SerializedDataVisualizerRow[] = [];
  private readonly __listeners = new Set<() => void>();

  constructor(
    _conduit: IConduit,
    [channel]: IChannel<DataVisualizerMessage>[],
    tabService: ITabService,
  ) {
    this.__channel = channel;
    this.__channel.subscribe(message => {
      if (message.type === "rows") {
        this.__rows = message.rows;
        this.__emit();
      }
    });
    // Ask the runner to replay the rows it last computed (e.g. tab opened after a run).
    this.__channel.send({ type: "request" });

    const subscribe = (listener: () => void) => this.subscribe(listener);
    const getRows = () => this.getRows();
    function DataVisualizerTab() {
      const rows = useSyncExternalStore(subscribe, getRows);
      return createElement(DataVisualizerView, { rows });
    }

    const tab: Tab = {
      id: TAB_ID,
      label: "Data Visualizer",
      iconName: "eye-open",
      body: createElement(DataVisualizerTab),
    };
    tabService.registerTab(tab);
    // Reveal, don't show: this plugin loads as soon as the language starts (before the student has
    // called draw_data), so it must not steal focus from whichever tab is already selected (e.g. the
    // welcome/introduction tab) - it should just become available in the tab bar for the student to
    // click into on their own.
    tabService.revealTab(tab.id);
  }

  /** The most recently received rows. */
  getRows(): SerializedDataVisualizerRow[] {
    return this.__rows;
  }

  /** Subscribe to row updates. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.__listeners.add(listener);
    return () => this.__listeners.delete(listener);
  }

  private __emit(): void {
    this.__listeners.forEach(listener => listener());
  }
}
checkIsPluginClass(DataVisualizerHostPlugin);
