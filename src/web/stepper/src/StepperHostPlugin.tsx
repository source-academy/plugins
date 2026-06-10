import {
  STEPPER_CHANNEL_ID,
  WEB_ID,
  type SerializedStepperStep,
  type StepperMessage,
} from "@sourceacademy/common-stepper";
import { IChannel, IConduit, IPlugin } from "@sourceacademy/conductor/conduit";
import { createElement, useSyncExternalStore } from "react";

import StepperView from "./SubstVisualizer";

/**
 * Describes a side-content tab contributed by a web plugin. The frontend's generic plugin-tab host
 * reads this structurally (it does not import the plugin's types), so any web plugin that exposes a
 * `tab` can render UI without per-plugin frontend code.
 */
export interface PluginTab {
  /** Stable id for the tab. */
  id: string;
  /** Tab label shown to the user. */
  label: string;
  /** Blueprint icon name for the tab. */
  iconName: string;
  /** The React component rendered as the tab body. Self-contained; takes no props. */
  Component: React.ComponentType;
}

/**
 * The host (browser-side) half of the stepper. It listens on the stepper channel for steps pushed
 * by the runner plugin, holds them as an external store, and exposes a {@link PluginTab} whose
 * component renders them. This plugin is entirely language-agnostic — it only knows the serialized
 * step protocol from `@sourceacademy/common-stepper`.
 */
export class StepperHostPlugin implements IPlugin {
  static readonly channelAttach = [STEPPER_CHANNEL_ID];
  readonly id: string = WEB_ID;

  private readonly __stepperChannel: IChannel<StepperMessage>;
  private __steps: SerializedStepperStep[] = [];
  private __error: string | null = null;
  private readonly __listeners = new Set<() => void>();

  readonly tab: PluginTab;

  constructor(_conduit: IConduit, [stepperChannel]: IChannel<StepperMessage>[]) {
    this.__stepperChannel = stepperChannel;
    this.__stepperChannel.subscribe(message => {
      if (message.type === "steps") {
        this.__steps = message.steps;
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
    this.tab = {
      id: "stepper",
      label: "Stepper",
      iconName: "flow-review",
      Component: function StepperTab() {
        const steps = useSyncExternalStore(
          listener => plugin.subscribe(listener),
          () => plugin.getSteps(),
        );
        return createElement(StepperView, { content: steps });
      },
    };
  }

  /** The most recently received steps. */
  getSteps(): SerializedStepperStep[] {
    return this.__steps;
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
