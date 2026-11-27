import type { CseSnapshot, CseTraceEnd } from "@sourceacademy/common-cse-machine";
import type { IHostContract, ITabService, Tab } from "@sourceacademy/common-tabs";
import { checkIsPluginClass, type IChannel, type IConduit } from "@sourceacademy/conductor/conduit";
import { createElement, useSyncExternalStore } from "react";

import CseMachineView from "./CseMachineView";
import { CseMachineHostPlugin } from "./CseMachineHostPlugin";

/** The id of the side-content tab, as the plugin directory's entry for this plugin names it. */
export const CSE_MACHINE_TAB_ID = "cse-machine";

interface State {
  snapshots: CseSnapshot[] | null;
  breakpointSteps: number[];
  end: CseTraceEnd | null;
}

/**
 * The CSE machine as a web plugin that contributes its own tab, as the E-Stepper does: it receives
 * the run's snapshots (the transport of {@link CseMachineHostPlugin}), keeps them, and draws them
 * with the environment-diagram library. It asks the host for nothing but the optional
 * `editor.highlight`, with which it marks the line of the step.
 */
export class CseMachineTabPlugin extends CseMachineHostPlugin {
  private __state: State = { snapshots: null, breakpointSteps: [], end: null };
  private readonly __listeners = new Set<() => void>();

  constructor(
    conduit: IConduit,
    channels: IChannel<unknown>[],
    tabService: ITabService,
    /** What the host offers beyond the tab service; every part of it is optional. */
    hostContract?: IHostContract,
  ) {
    super(conduit, channels);

    const subscribe = (listener: () => void) => this.subscribe(listener);
    const getState = () => this.getState();
    const editor = hostContract?.editor;
    function CseMachineTab() {
      const state = useSyncExternalStore(subscribe, getState);
      return createElement(CseMachineView, { ...state, editor });
    }

    const tab: Tab = {
      id: CSE_MACHINE_TAB_ID,
      label: "CSE Machine",
      iconName: "globe",
      // The tab draws the program's state and its own controls, so the host has no use for its
      // REPL, and the diagram is laid out for the width it is given.
      hidesRepl: true,
      resizable: false,
      body: createElement(CseMachineTab),
    };
    tabService.registerTab(tab);
    // Reveal, don't show: the tab is offered, and the user opens it.
    tabService.revealTab(tab.id);
  }

  receiveSnapshots(snapshots: CseSnapshot[], breakpointSteps: number[]): void {
    // A run sent whole, or the snapshots so far of one sent in batches: its end is not known yet.
    this.__state = { snapshots, breakpointSteps, end: null };
    this.__emit();
  }

  override receiveEnd(end: CseTraceEnd): void {
    this.__state = { ...this.__state, end };
    this.__emit();
  }

  /** The snapshots of the run, with its breakpoints and how it ended. */
  getState(): State {
    return this.__state;
  }

  /** Subscribe to updates. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.__listeners.add(listener);
    return () => this.__listeners.delete(listener);
  }

  private __emit(): void {
    this.__listeners.forEach(listener => listener());
  }
}
checkIsPluginClass(CseMachineTabPlugin);
