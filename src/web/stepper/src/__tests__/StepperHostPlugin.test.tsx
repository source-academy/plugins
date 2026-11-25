import type { StepperMessage } from "@sourceacademy/common-stepper";
import type { Tab } from "@sourceacademy/common-tabs";
import { describe, expect, test, vi } from "vitest";

// The hotkey library needs react-dom, which it does not declare (so it does not resolve here).
vi.mock("@mantine/hooks", () => ({ getHotkeyHandler: () => () => {} }));

import { StepperHostPlugin } from "../StepperHostPlugin";

type PluginArgs = ConstructorParameters<typeof StepperHostPlugin>;

function setUp() {
  const sent: StepperMessage[] = [];
  const channel = {
    name: "__stepper",
    subscribe: () => {},
    unsubscribe: () => {},
    send: (message: StepperMessage) => sent.push(message),
    close: () => {},
  };
  let tab!: Tab;
  const tabService = { registerTab: (t: Tab) => (tab = t), revealTab: vi.fn() };
  new StepperHostPlugin({} as PluginArgs[0], [channel], tabService);
  return { tab, tabService, sent };
}

describe("StepperHostPlugin", () => {
  test("registers and reveals the Stepper tab, and asks for the last run's steps", () => {
    const { tab, tabService, sent } = setUp();
    expect(tab).toMatchObject({ id: "stepper", label: "Stepper", iconName: "flow-review" });
    expect(tabService.revealTab).toHaveBeenCalledWith("stepper");
    expect(sent).toEqual([{ type: "request" }]);
  });

  test("tells the host to hide its REPL and to keep the side content's size", () => {
    expect(setUp().tab).toMatchObject({ hidesRepl: true, resizable: false });
  });
});
