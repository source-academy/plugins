// @vitest-environment jsdom
import {
  CSE_CHANNEL,
  CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
  type CseSnapshot,
} from "@sourceacademy/common-cse-machine";
import type { IHostContract, ITabService, Tab } from "@sourceacademy/common-tabs";
import type { IChannel, IConduit } from "@sourceacademy/conductor/conduit";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CSE_MACHINE_TAB_ID, CseMachineTabPlugin } from "../CseMachineTabPlugin";
import CseMachineView from "../CseMachineView";

afterEach(() => {
  cleanup();
});

/** A snapshot of one global frame binding `x`, at the given 1-based source line. */
const snapshot = (stepIndex: number, currentLine?: number): CseSnapshot => ({
  stepIndex,
  control: [],
  stash: [],
  environments: [
    {
      id: "g",
      name: "global",
      parentId: null,
      bindings: [{ name: "x", value: { displayValue: String(stepIndex), label: "int" } }],
      isActive: true,
    },
  ],
  ...(currentLine !== undefined ? { currentLine } : {}),
});

const run = [snapshot(0, 1), snapshot(1, 2), snapshot(2, 3)];

describe("CseMachineView", () => {
  const editor = () => ({ highlight: vi.fn() });

  test("without a run it explains itself and its controls are off", () => {
    render(<CseMachineView snapshots={null} breakpointSteps={[]} end={null} />);
    expect(screen.getByTestId("cse-machine-default-text")).toBeTruthy();
    const next = document.querySelector('[icon="chevron-right"], .bp6-icon-chevron-right');
    expect(next?.closest("button")?.hasAttribute("disabled")).toBe(true);
  });

  test("marks the line of the first step in the editor, in the contract's 1-based lines", () => {
    const host = editor();
    render(<CseMachineView snapshots={run} breakpointSteps={[]} end={null} editor={host} />);
    expect(host.highlight).toHaveBeenLastCalledWith([[1, 1]]);
  });

  test("the f and b keys move on and back, and the line follows the step", () => {
    const host = editor();
    const { container } = render(
      <CseMachineView snapshots={run} breakpointSteps={[]} end={null} editor={host} />,
    );
    const tab = container.firstElementChild as HTMLElement;

    act(() => {
      fireEvent.keyDown(tab, { key: "f" });
    });
    expect(host.highlight).toHaveBeenLastCalledWith([[2, 2]]);

    act(() => {
      fireEvent.keyDown(tab, { key: "e" });
    });
    expect(host.highlight).toHaveBeenLastCalledWith([[3, 3]]);

    act(() => {
      fireEvent.keyDown(tab, { key: "b" });
    });
    expect(host.highlight).toHaveBeenLastCalledWith([[2, 2]]);

    act(() => {
      fireEvent.keyDown(tab, { key: "a" });
    });
    expect(host.highlight).toHaveBeenLastCalledWith([[1, 1]]);
  });

  test("a step without a current line marks nothing", () => {
    const host = editor();
    render(
      <CseMachineView snapshots={[snapshot(0)]} breakpointSteps={[]} end={null} editor={host} />,
    );
    expect(host.highlight).toHaveBeenLastCalledWith([]);
  });

  test("clears the editor's highlight when the tab goes away", () => {
    const host = editor();
    const { unmount } = render(
      <CseMachineView snapshots={run} breakpointSteps={[]} end={null} editor={host} />,
    );
    host.highlight.mockClear();
    unmount();
    expect(host.highlight).toHaveBeenCalledWith([]);
  });

  test("the slider labels a round number of steps, and the last one, however long the run", () => {
    const long = Array.from({ length: 41 }, (_, i) => snapshot(i, 1));
    const { container } = render(
      <CseMachineView snapshots={long} breakpointSteps={[]} end={null} />,
    );
    const labels = [...container.querySelectorAll(".bp6-slider-axis .bp6-slider-label")].map(
      label => label.textContent,
    );
    // Blueprint's default would label all of 0 to 40.
    expect(labels.length).toBeLessThanOrEqual(12);
    expect(labels[0]).toBe("0");
    expect(labels.at(-1)).toBe("40");
  });

  test("an empty run replaces the one before: the diagram and the highlight go", () => {
    const host = editor();
    const { rerender } = render(
      <CseMachineView snapshots={run} breakpointSteps={[]} end={null} editor={host} />,
    );
    expect(screen.queryByTestId("cse-machine-default-text")).toBeNull();
    host.highlight.mockClear();

    rerender(<CseMachineView snapshots={[]} breakpointSteps={[]} end={null} editor={host} />);

    expect(screen.getByTestId("cse-machine-default-text")).toBeTruthy();
    expect(host.highlight).toHaveBeenCalledWith([]);
  });

  test("says when the run was cut off, beside the diagram", () => {
    render(
      <CseMachineView
        snapshots={run}
        breakpointSteps={[]}
        end={{ status: "cut-off", reason: "step limit of 1000" }}
      />,
    );
    expect(screen.getByTestId("cse-machine-cut-off").textContent).toContain("step limit of 1000");
  });

  test("works with a host that has no editor", () => {
    expect(() =>
      render(<CseMachineView snapshots={run} breakpointSteps={[]} end={null} />),
    ).not.toThrow();
  });
});

/** The plugin does not use its conduit: the channel it is given is all it talks to. */
const noConduit: IConduit = undefined as never;

describe("CseMachineTabPlugin", () => {
  function setup(hostContract?: IHostContract) {
    let subscriber: ((message: unknown) => void) | undefined;
    const channel = {
      subscribe: (fn: (message: unknown) => void) => {
        subscriber = fn;
      },
    } as unknown as IChannel<unknown>;
    const tabs: Tab[] = [];
    const tabService: ITabService = {
      registerTab: vi.fn((tab: Tab) => void tabs.push(tab)),
      unregisterTab: vi.fn(),
      showTab: vi.fn(),
      revealTab: vi.fn(),
      hideTab: vi.fn(),
    };
    const plugin = new CseMachineTabPlugin(noConduit, [channel], tabService, hostContract);
    return { plugin, tabs, tabService, emit: (message: unknown) => subscriber?.(message) };
  }

  test("is attached to the CSE channel", () => {
    expect(CseMachineTabPlugin.channelAttach).toEqual([CSE_CHANNEL]);
  });

  test("contributes the CSE Machine tab, which hides the REPL and is not resizable, and reveals it", () => {
    const { tabs, tabService } = setup();
    expect(tabs).toHaveLength(1);
    expect(tabs[0]).toMatchObject({
      id: CSE_MACHINE_TAB_ID,
      label: "CSE Machine",
      hidesRepl: true,
      resizable: false,
    });
    expect(tabService.revealTab).toHaveBeenCalledWith(CSE_MACHINE_TAB_ID);
    expect(tabService.showTab).not.toHaveBeenCalled();
  });

  test("keeps the snapshots of the batches of a run, and how it ended", () => {
    const { plugin, emit } = setup();
    expect(plugin.getState().snapshots).toBeNull();

    emit({ type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH, index: 0, snapshots: run.slice(0, 2) });
    expect(plugin.getState().snapshots).toHaveLength(2);
    expect(plugin.getState().end).toBeNull();

    emit({
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: 2,
      snapshots: run.slice(2),
      breakpointSteps: [2],
      end: { status: "complete" },
    });
    expect(plugin.getState().snapshots).toHaveLength(3);
    expect(plugin.getState().breakpointSteps).toEqual([2]);
    expect(plugin.getState().end).toEqual({ status: "complete" });
  });

  test("a run of batches that has no snapshots replaces the run before it", () => {
    const { plugin, emit } = setup();
    emit({ type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH, index: 0, snapshots: run });
    emit({
      type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH,
      index: 0,
      snapshots: [],
      end: { status: "complete" },
    });
    expect(plugin.getState().snapshots).toEqual([]);
    expect(plugin.getState().end).toEqual({ status: "complete" });
  });

  test("tells its tab when the state changes", () => {
    const { plugin, emit } = setup();
    const listener = vi.fn();
    const unsubscribe = plugin.subscribe(listener);
    emit({ type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH, index: 0, snapshots: run });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    emit({ type: CSE_MESSAGE_TYPE_SNAPSHOT_BATCH, index: 0, snapshots: run });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
