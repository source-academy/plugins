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
   * @param id The id of the tab to be displayed. This should correspond to the id of a tab that has been registered with the tab service.
   */
  showTab(id: string): void;

  /**
   * The hideTab method is used to hide a tab that is currently being displayed. The tab is identified by its id, which is passed as an argument to the method. When the hideTab method is called, the tab service will stop rendering the corresponding tab component, effectively hiding it from view. This allows for dynamic hiding of tabs based on user interactions or other events.
   */
  hideTab(id: string): void;
}
