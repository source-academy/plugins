import type { IconName } from "@blueprintjs/icons";
import type React from "react";

/**
 * The Tab interface represents a tab that can be registered with the tab service.
 * It contains an id, title, and a React component that will be rendered when the tab is displayed.
 * The id is used to identify the tab when it is registered and when it is displayed or hidden.
 * The title is used to display the name of the tab in the UI.
 * The tab component is the React component that will be rendered when the tab is displayed.
 */
export type Tab = {
  label: string;
  iconName: IconName;
  body: React.ReactElement | null;
  id: string;
  disabled?: boolean;
  /**
   * Whether the host hides its own REPL while this tab is the selected one. For a tab that shows the
   * program's output itself, such as a stepper, which has no use for a second place to type and
   * print. Defaults to `false`.
   */
  hidesRepl?: boolean;
  /**
   * Whether the user can resize the host's side content while this tab is selected. Defaults to
   * `true`; `false` for a tab whose layout depends on the space it was given, such as a stepper.
   */
  resizable?: boolean;
};

export interface ITabService {
  /**
   * Registers a tab with the tab service. This allows for dynamic rendering of tabs based on the arguments passed in.
   * The tab can be displayed by calling the showTab method with the id of the tab.
   * @param tab The tab to be loaded
   */
  registerTab(tab: Tab): void;

  /**
   * Should be called when a tab is no longer needed. This allows the tab service to clean up any resources associated with the tab and prevent memory leaks.
   * @param id The id of the tab to unregister.
   */
  unregisterTab(id: string): void;

  /**
   * The showTab method is used to display a tab that has been registered with the tab service. The tab is identified by its id, which is passed as an argument to the method. When the showTab method is called, the tab service will render the corresponding tab component with the arguments that were passed in when the tab was registered. This allows for dynamic rendering of tabs based on the arguments passed in.
   *
   * This also focuses the tab (makes it the currently-selected one) — appropriate when a plugin
   * decides on its own, mid-session, that the student should be looking at it right now (e.g. a
   * sound module the moment it starts playing/recording). Use {@link revealTab} instead when a tab
   * should simply become available in the tab bar without stealing focus from whatever the student
   * is currently looking at (e.g. when the plugin first loads).
   * @param id The id of the tab to be displayed. This should correspond to the id of a tab that has been registered with the tab service.
   */
  showTab(id: string): void;

  /**
   * Makes a registered tab visible in the tab bar without changing which tab is currently selected —
   * the visible-but-unfocused counterpart to {@link showTab}.
   * @param id The id of the tab to reveal. This should correspond to the id of a tab that has been registered with the tab service.
   */
  revealTab(id: string): void;

  /**
   * The hideTab method is used to hide a tab that is currently being displayed. The tab is identified by its id, which is passed as an argument to the method. When the hideTab method is called, the tab service will stop rendering the corresponding tab component, effectively hiding it from view. This allows for dynamic hiding of tabs based on user interactions or other events.
   */
  hideTab(id: string): void;

  /**
   * Draws the attention of the user to a tab that is not the selected one, because something new has
   * arrived in it (for example the steps of a run that has just finished). A host may leave this
   * out; a plugin calls it as `tabService.alertTab?.(id)`.
   * @param id The id of the tab to alert.
   */
  alertTab?(id: string): void;

  /**
   * Whether the tab is the one that the user is looking at. A host may leave this out, and then a
   * plugin cannot tell.
   * @param id The id of a registered tab.
   */
  isTabSelected?(id: string): boolean;

  /**
   * Calls `listener` with `true` when the tab becomes the selected one and with `false` when it
   * stops being so. A host may leave this out.
   * @param id The id of a registered tab.
   * @param listener Called on every change of the tab's selection.
   * @returns A function that stops the listening.
   */
  onTabSelectionChange?(id: string, listener: (selected: boolean) => void): () => void;
}

/**
 * A range of lines of the editor: the first and the last, 1-based and inclusive, as the editor shows
 * them. Columns are not part of it yet; they can be added as an optional field.
 */
export type LineRange = readonly [first: number, last: number];

/**
 * How a highlight is drawn is the host's to decide, in its own theme. `primary` is the place that
 * the visualization is at (the line being evaluated), `secondary` a place that goes with it (for
 * example the lines of the item that is next on the control).
 */
export type HighlightKind = "primary" | "secondary";

/** What a host offers a plugin to do with the editor. */
export interface IEditorService {
  /**
   * Marks lines of the editor, replacing what `owner` has marked with the same `kind` before. A tab
   * clears what it has marked when it is deselected, and the host clears it when the owner's tab is
   * unregistered.
   * @param owner The id of the plugin, or of its tab: highlights are kept apart by it.
   * @param lines The lines to mark; none removes the highlights of that kind.
   * @param kind How the lines are to look.
   */
  highlight(owner: string, lines: readonly LineRange[], kind: HighlightKind): void;

  /** Removes all the highlights that `owner` has made, of every kind. */
  clearHighlights(owner: string): void;
}

/** What a host offers a plugin to do with the run of the program. */
export interface IRunService {
  /** Asks the host to run the program again, as its Run button does. */
  request(): void;
}

/**
 * The host contract: what a host may offer a plugin that contributes a tab, apart from the tab
 * service. It is for every visualizer and names no tool and no language. Every service is optional
 * (so is every new member of {@link ITabService}): a plugin works with a host that offers none of
 * them, a host that offers them works with a plugin that uses none, and the contract grows by
 * adding members.
 */
export interface IHostContract {
  readonly editor?: IEditorService;
  readonly run?: IRunService;
}
