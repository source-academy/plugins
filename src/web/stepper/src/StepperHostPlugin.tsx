import {
  STEPPER_CHANNEL_ID,
  WEB_ID,
  type SerializedStepperStep,
  type StepperMessage,
  type SyntaxProfile,
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
        this.__emit();
      } else if (message.type === "error") {
        this.__steps = [];
        this.__error = message.error;
        this.__emit();
      }
    });
    // Ask the runner to replay any steps it already computed (e.g. tab opened after a run).
    this.__stepperChannel.send({ type: "request" });

    const plugin = this;
    function StepperTab() {
      const steps = useSyncExternalStore(
        listener => plugin.subscribe(listener),
        () => plugin.getSteps(),
      );
      // The profile updates together with the steps (same message), so reading it here is current.
      return createElement(StepperView, { content: steps, profile: plugin.getProfile() });
    }

    const tab: Tab = {
      id: TAB_ID,
      label: "Stepper",
      iconName: "flow-review",
      body: createElement(StepperTab),
    };
    tabService.registerTab(tab);
    tabService.showTab(tab.id);
  }

  /** The most recently received steps. */
  getSteps(): SerializedStepperStep[] {
    return this.__steps;
  }

  /** The active language's rendering rules from the most recent run, if any. */
  getProfile(): SyntaxProfile | undefined {
    return this.__profile;
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
