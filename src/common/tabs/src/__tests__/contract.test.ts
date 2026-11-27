import { describe, expect, expectTypeOf, test } from "vitest";

import type {
  HighlightKind,
  IEditorService,
  IHostContract,
  IRunService,
  ITabService,
  LineRange,
} from "..";

describe("the host contract", () => {
  test("a host that has none of the newer members is still a tab service", () => {
    // What a host written before the alert and the selection were added looks like.
    const olderHost = {
      registerTab: () => {},
      unregisterTab: () => {},
      showTab: () => {},
      revealTab: () => {},
      hideTab: () => {},
    } satisfies ITabService;
    expectTypeOf(olderHost).toMatchTypeOf<ITabService>();
    // A plugin has to ask first, and gets to know that it cannot be told.
    const tabService: ITabService = olderHost;
    expect(tabService.alertTab).toBeUndefined();
    expect(tabService.isTabSelected?.("any")).toBeUndefined();
    expect(tabService.onTabSelectionChange).toBeUndefined();
  });

  test("a host can offer any of the services, or none", () => {
    const none: IHostContract = {};
    const editorOnly: IHostContract = {
      editor: { highlight: () => {}, clearHighlights: () => {} },
    };
    const runOnly: IHostContract = { run: { request: () => {} } };
    expect(none.editor).toBeUndefined();
    expect(editorOnly.run).toBeUndefined();
    expect(runOnly.editor).toBeUndefined();
  });

  test("the services are what the tab of a visualizer needs", () => {
    const calls: unknown[][] = [];
    const editor: IEditorService = {
      highlight: (owner, lines, kind) => calls.push(["highlight", owner, lines, kind]),
      clearHighlights: owner => calls.push(["clear", owner]),
    };
    const run: IRunService = { request: () => calls.push(["run"]) };

    const lines: readonly LineRange[] = [
      [3, 3],
      [5, 7],
    ];
    const kind: HighlightKind = "primary";
    editor.highlight("cse-machine", lines, kind);
    editor.clearHighlights("cse-machine");
    run.request();

    expect(calls).toEqual([
      [
        "highlight",
        "cse-machine",
        [
          [3, 3],
          [5, 7],
        ],
        "primary",
      ],
      ["clear", "cse-machine"],
      ["run"],
    ]);
    expectTypeOf<HighlightKind>().toEqualTypeOf<"primary" | "secondary">();
    expectTypeOf<LineRange>().toEqualTypeOf<readonly [first: number, last: number]>();
  });
});
