import {
  E_STEPPER_CHANNEL_ID,
  WEB_ID,
  type EStepperMessage,
  type EStepperStep,
  type SyntaxProfile,
  type TraceEnd,
} from "@sourceacademy/common-e-stepper";
import type { ICseDiagramService, IHostServices } from "@sourceacademy/common-cse-machine";
import { CseEnvironmentView } from "@sourceacademy/web-environment-diagram";
import type { ITabService, Tab } from "@sourceacademy/common-tabs";
import {
  checkIsPluginClass,
  type IChannel,
  type IConduit,
  type IPlugin,
} from "@sourceacademy/conductor/conduit";
import { createElement, useSyncExternalStore } from "react";

import EStepperView, { type PaneLayout } from "./EStepperView";

/**
 * The CSE machine's environment diagram, from the environment-diagram library. The view draws
 * through the same interface that hosts used to lend (`ICseDiagramService`), so that it works
 * without the host's CSE machine, which the frontend is about to lose.
 */
const libraryDiagram: ICseDiagramService = {
  createView: props => createElement(CseEnvironmentView, props),
};

/** The side-content tab id used by the host to show/hide the e-stepper tab. */
const TAB_ID = "e-stepper";

/**
 * The user's arrangement of the panes, kept on `globalThis` for the page. Neither the plugin nor this
 * module will do: the host terminates the conduit and makes a new plugin on every Run, and the
 * bundle is wrapped in a factory (see `wrap.mjs`) that the host calls again each time, so even a
 * module-level variable is new on every Run. The divider is to stay where the user put it.
 */
const LAYOUT_KEY = Symbol.for("sourceacademy.e-stepper.layout");
const layout: PaneLayout = ((globalThis as Record<symbol, unknown>)[LAYOUT_KEY] ??= {});

interface State {
  steps: EStepperStep[];
  profile?: SyntaxProfile;
  error: string | null;
  /**
   * How the most recent run's trace ended, once it has: complete, or cut off by the runner. Absent
   * while it is arriving, and for a run that was stopped before it ended.
   */
  end?: TraceEnd;
}

/**
 * The host (browser-side) half of the environment stepper ("e-stepper"). Like the stepper's host
 * plugin, it listens on its channel for the steps pushed by the runner plugin, holds them as an
 * external store, and contributes a side-content tab that renders them — here the program together
 * with its environment diagram (drawn with the environment-diagram library when the steps carry CSE
 * snapshots, and by the plugin's own diagram otherwise). Language-agnostic: it only knows the protocol from
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
    /**
     * The services that older hosts lend. Not used: the environments are drawn with the
     * environment-diagram library, which is part of this bundle.
     * @deprecated
     */
    _hostServices?: IHostServices,
  ) {
    this.__channel = channel;
    this.__channel.subscribe(message => {
      if (message.type === "steps") {
        // A trace sent whole is a complete one.
        this.__state = {
          steps: message.steps,
          profile: message.profile,
          error: null,
          end: { status: "complete" },
        };
        this.__emit();
      } else if (message.type === "batch") {
        // A batch continues the steps that came before it (index 0 starts the run afresh). One
        // that does not (a batch was missed) is dropped rather than put in the wrong place.
        const { steps, profile, end } = this.__state;
        if (message.index > steps.length) return;
        this.__state = {
          steps: steps.slice(0, message.index).concat(message.steps),
          profile: message.index === 0 ? message.profile : profile,
          error: null,
          end: message.end ?? (message.index === 0 ? undefined : end),
        };
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
    const cseDiagram: ICseDiagramService = libraryDiagram;
    function EStepperTab() {
      const state = useSyncExternalStore(subscribe, getState);
      return createElement(EStepperView, {
        steps: state.steps,
        profile: state.profile,
        error: state.error,
        cutOff: state.end?.status === "cut-off" ? state.end.reason : undefined,
        cseDiagram,
        layout,
      });
    }

    const tab: Tab = {
      id: TAB_ID,
      label: "E-Stepper",
      // The Stepper's icon: the two never appear together (Stepper: Python §1-2, E-Stepper: §3-4).
      iconName: "flow-review",
      // The tab shows the program and its output itself, so the host has no use for its REPL, and the
      // layout of the steps depends on the width it was given.
      hidesRepl: true,
      resizable: false,
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
