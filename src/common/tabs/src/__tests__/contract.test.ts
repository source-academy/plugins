import { describe, expect, expectTypeOf, test } from "vitest";

import type { IEditorService, IHostContract, LineRange } from "..";

describe("the host contract", () => {
  test("a host can offer the editor, or nothing", () => {
    const none: IHostContract = {};
    const withEditor: IHostContract = { editor: { highlight: () => {} } };
    expect(none.editor).toBeUndefined();
    expect(withEditor.editor).toBeDefined();
  });

  test("a plugin marks lines with one call, and clears them with none", () => {
    const calls: (readonly LineRange[])[] = [];
    const editor: IEditorService = { highlight: lines => calls.push(lines) };

    editor.highlight([
      [3, 3],
      [5, 7],
    ]);
    editor.highlight([]);

    expect(calls).toEqual([
      [
        [3, 3],
        [5, 7],
      ],
      [],
    ]);
    expectTypeOf<LineRange>().toEqualTypeOf<readonly [first: number, last: number]>();
  });
});
