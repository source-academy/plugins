import {
  E_STEPPER_CHANNEL_ID,
  WEB_ID,
  type EStepperMessage,
  type EStepperStep,
  type SyntaxProfile,
} from "@sourceacademy/common-e-stepper";
import type { ICseDiagramService, IHostServices } from "@sourceacademy/common-cse-machine";
import type { ITabService, Tab } from "@sourceacademy/common-tabs";
import {
  checkIsPluginClass,
  type IChannel,
  type IConduit,
  type IPlugin,
} from "@sourceacademy/conductor/conduit";
import { createElement, useSyncExternalStore } from "react";

import EStepperView, { type PaneLayout } from "./EStepperView";

/** The side-content tab id used by the host to show/hide the e-stepper tab. */
const TAB_ID = "e-stepper";

interface State {
  steps: EStepperStep[];
  profile?: SyntaxProfile;
  error: string | null;
}

/**
 * The host (browser-side) half of the environment stepper ("e-stepper"). Like the stepper's host
 * plugin, it listens on its channel for the steps pushed by the runner plugin, holds them as an
 * external store, and contributes a side-content tab that renders them — here the program together
 * with its environment diagram (drawn by the host's CSE machine visualization when the host lends
 * it — see `ICseDiagramService` — and by the plugin's own diagram otherwise). Language-agnostic: it only knows the protocol from
 * `@sourceacademy/common-e-stepper` and the tab-service contract from `@sourceacademy/common-tabs`.
 */
export class EStepperHostPlugin implements IPlugin {
  static readonly channelAttach = [E_STEPPER_CHANNEL_ID];
  readonly id: string = WEB_ID;

  private readonly __channel: IChannel<EStepperMessage>;
  private __state: State = { steps: [], error: null };
  private readonly __listeners = new Set<() => void>();

  constructor(
    _conduit: IConduit,
    [channel]: IChannel<EStepperMessage>[],
    tabService: ITabService,
    /** The host's optional services; with a CSE diagram service, the environments are drawn with
     * the host's CSE machine visualization instead of the plugin's own diagram. */
    hostServices?: IHostServices,
  ) {
    this.__channel = channel;
    this.__channel.subscribe(message => {
      if (message.type === "steps") {
        this.__state = { steps: message.steps, profile: message.profile, error: null };
        this.__emit();
      } else if (message.type === "error") {
        this.__state = { steps: [], error: message.error };
        this.__emit();
      }
    });
    // Ask the runner to replay any steps it already computed (e.g. tab opened after a run).
    this.__channel.send({ type: "request" });

    const subscribe = (listener: () => void) => this.subscribe(listener);
    const getState = () => this.getState();
    // Kept here, not in the view: a run may mount the view anew, and the user's divider stays.
    const layout: PaneLayout = {};
    const cseDiagram: ICseDiagramService | undefined = hostServices?.cseDiagram;
    function EStepperTab() {
      const state = useSyncExternalStore(subscribe, getState);
      return createElement(EStepperView, {
        steps: state.steps,
        profile: state.profile,
        error: state.error,
        cseDiagram,
        layout,
      });
    }

    const tab: Tab = {
      id: TAB_ID,
      label: "E-Stepper",
      // The Stepper's icon: the two never appear together (Stepper: Python §1-2, E-Stepper: §3-4).
      iconName: "flow-review",
      body: createElement(EStepperTab),
    };
    tabService.registerTab(tab);
    // Reveal, don't show — see the stepper's host plugin for why.
    tabService.revealTab(tab.id);
  }

  /** The most recent steps, profile and error. */
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
checkIsPluginClass(EStepperHostPlugin);
