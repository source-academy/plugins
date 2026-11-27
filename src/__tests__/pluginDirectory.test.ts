// @vitest-environment jsdom
/**
 * The plugin directory describes the tab of each web plugin that contributes one, so that a host can
 * show a placeholder and know how the tab behaves before the plugin is loaded. This checks that
 * what the directory says is what the plugin registers.
 */
import type { Tab } from "@sourceacademy/common-tabs";
import { plugins } from "@sourceacademy/plugin-directory";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, test, vi } from "vitest";

// Only the tab that a host plugin registers matters here, not the view in it (which has its own
// tests, and needs a canvas or a hotkey library that is not wanted here).
vi.mock("../web/stepper/src/SubstVisualizer", () => ({ default: () => null }));
vi.mock("../web/e-stepper/src/EStepperView", () => ({ default: () => null }));
vi.mock("../web/data-visualizer/src/DataVisualizerView", () => ({ default: () => null }));

import { DataVisualizerHostPlugin } from "../web/data-visualizer/src/DataVisualizerHostPlugin";
import { EStepperHostPlugin } from "../web/e-stepper/src/EStepperHostPlugin";
import { StepperHostPlugin } from "../web/stepper/src/StepperHostPlugin";

// Every web plugin that registers a tab, by its id in the directory.
const hostPlugins = {
  stepper: StepperHostPlugin,
  "e-stepper": EStepperHostPlugin,
  "data-visualizer": DataVisualizerHostPlugin,
} as const;

function registeredTab(id: keyof typeof hostPlugins): Tab {
  const channel = {
    name: "",
    subscribe: () => {},
    unsubscribe: () => {},
    send: () => {},
    close: () => {},
  };
  let tab: Tab | undefined;
  const tabService = {
    registerTab: (t: Tab) => (tab = t),
    revealTab: () => {},
  };
  // The three have the same shape (conduit, channels, tab service); the runtime check is the test.
  const Plugin = hostPlugins[id] as unknown as new (...args: unknown[]) => unknown;
  new Plugin({}, [channel], tabService);
  if (!tab) throw new Error(`${id} registered no tab`);
  return tab;
}

describe("plugin directory", () => {
  test("every plugin that registers a tab says so, and every tab it says is registered", () => {
    const withTab = plugins.filter(plugin => plugin.tab).map(plugin => plugin.id);
    expect(withTab.sort()).toEqual(Object.keys(hostPlugins).sort());
  });

  test.each(Object.keys(hostPlugins) as (keyof typeof hostPlugins)[])(
    "the directory's tab of %s is the tab it registers",
    id => {
      const described = plugins.find(plugin => plugin.id === id)?.tab;
      const { body: _body, ...registered } = registeredTab(id);
      expect({ hidesRepl: false, resizable: true, ...described }).toEqual({
        hidesRepl: false,
        resizable: true,
        ...registered,
      });
    },
  );
});

// What a host loads is the directory.json that `yarn build` generates, not the package above, so
// it must carry the tabs too (it once did not, and the frontend then showed no Stepper tab).
// CI builds before it tests; without a build there is nothing to check.
describe.skipIf(!existsSync("dist/directory.json"))("the generated directory.json", () => {
  const generated: { id: string; tab?: unknown }[] = JSON.parse(
    existsSync("dist/directory.json") ? readFileSync("dist/directory.json", "utf-8") : "[]",
  );

  test.each(plugins.filter(plugin => plugin.tab))("describes the tab of $id", ({ id, tab }) => {
    expect(generated.find(plugin => plugin.id === id)?.tab).toEqual(tab);
  });
});
