import {
  STEPPER_CHANNEL_ID,
  WEB_ID,
  type SerializedStepperStep,
  type StepperMessage,
  type SyntaxProfile,
  type TraceEnd,
} from "@sourceacademy/common-stepper";
import type { ITabService, Tab } from "@sourceacademy/common-tabs";
import {
  checkIsPluginClass,
  type IChannel,
  type IConduit,
  type IPlugin,
} from "@sourceacademy/conductor/conduit";
import { createElement, useSyncExternalStore } from "react";

import StepperView from "./SubstVisualizer";

/** The side-content tab id used by the host to show/hide the stepper tab. */
const TAB_ID = "stepper";

/**
 * The host (browser-side) half of the stepper. It listens on the stepper channel for steps pushed
 * by the runner plugin, holds them as an external store, and contributes a side-content tab (via the
 * injected {@link ITabService}) whose body renders them.
 *
 * The plugin is entirely language-agnostic — it only knows the serialized step protocol from
 * `@sourceacademy/common-stepper`, plus the standard tab-service contract from
 * `@sourceacademy/common-tabs`. It is loaded dynamically by the host (no per-language frontend code).
 */
export class StepperHostPlugin implements IPlugin {
  static readonly channelAttach = [STEPPER_CHANNEL_ID];
  readonly id: string = WEB_ID;

  private readonly __stepperChannel: IChannel<StepperMessage>;
  private __steps: SerializedStepperStep[] = [];
  private __profile: SyntaxProfile | undefined = undefined;
  private __error: string | null = null;
  private __end: TraceEnd | undefined = undefined;
  private readonly __listeners = new Set<() => void>();

  constructor(
    _conduit: IConduit,
    [stepperChannel]: IChannel<StepperMessage>[],
    tabService: ITabService,
  ) {
    this.__stepperChannel = stepperChannel;
    this.__stepperChannel.subscribe(message => {
      if (message.type === "steps") {
        this.__steps = message.steps;
        this.__profile = message.profile;
        this.__error = null;
        // A trace sent whole is a complete one.
        this.__end = { status: "complete" };
        this.__emit();
      } else if (message.type === "batch") {
        // A batch continues the steps that came before it (index 0 starts the run afresh). One
        // that does not (a batch was missed) is dropped rather than put in the wrong place.
        if (message.index > this.__steps.length) return;
        this.__steps = this.__steps.slice(0, message.index).concat(message.steps);
        if (message.index === 0) {
          this.__profile = message.profile;
          this.__end = undefined;
        }
        if (message.end) this.__end = message.end;
        this.__error = null;
        this.__emit();
      } else if (message.type === "error") {
        this.__steps = [];
        this.__end = undefined;
        this.__error = message.error;
        this.__emit();
      }
    });
    // Ask the runner to replay any steps it already computed (e.g. tab opened after a run).
    this.__stepperChannel.send({ type: "request" });

    const subscribe = (listener: () => void) => this.subscribe(listener);
    const getSteps = () => this.getSteps();
    const getProfile = () => this.getProfile();
    const getEnd = () => this.getEnd();
    function StepperTab() {
      const steps = useSyncExternalStore(subscribe, getSteps);
      const end = useSyncExternalStore(subscribe, getEnd);
      // The profile updates together with the steps (same message), so reading it here is current.
      return createElement(StepperView, {
        content: steps,
        profile: getProfile(),
        cutOff: end?.status === "cut-off" ? end.reason : undefined,
      });
    }

    const tab: Tab = {
      id: TAB_ID,
      label: "Stepper",
      iconName: "flow-review",
      // The tab shows the program and its output itself, so the host has no use for its REPL, and the
      // layout of the steps depends on the width it was given.
      hidesRepl: true,
      resizable: false,
      body: createElement(StepperTab),
    };
    tabService.registerTab(tab);
    // Reveal, don't show: this plugin loads as soon as a stepping language starts, before the
    // student has actually stepped through anything — matching the Data Visualizer host plugin's
    // same reasoning (see its constructor). The tab is still reliably the selected one in the
    // common case: opening the Stepper tab is what selects this evaluator in the first place (see
    // frontend's stepperTab.ts), so the tab bar's own selection already points here by the time
    // this plugin finishes loading — this call only needs to make it visible, not steal focus.
    tabService.revealTab(tab.id);
  }

  /** The most recently received steps. */
  getSteps(): SerializedStepperStep[] {
    return this.__steps;
  }

  /** The active language's rendering rules from the most recent run, if any. */
  getProfile(): SyntaxProfile | undefined {
    return this.__profile;
  }

  /**
   * How the most recent run's trace ended, once it has: complete, or cut off by the runner (with
   * the reason). `undefined` while it is arriving, and for a run that was stopped before it ended.
   */
  getEnd(): TraceEnd | undefined {
    return this.__end;
  }

  /** The most recent stepping error, if any. */
  getError(): string | null {
    return this.__error;
  }

  /** Subscribe to step/error updates. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.__listeners.add(listener);
    return () => this.__listeners.delete(listener);
  }

  private __emit(): void {
    this.__listeners.forEach(listener => listener());
  }
}
checkIsPluginClass(StepperHostPlugin);
