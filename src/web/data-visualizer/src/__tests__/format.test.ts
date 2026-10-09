import { describe, expect, test } from "vitest";

import { formatRoot } from "../format";
import { DataTreeNode } from "../tree/DataTreeNode";

describe(formatRoot, () => {
  test("shows the language's own spelling of an empty value drawn on its own", () => {
    expect(formatRoot(DataTreeNode.empty("None"))).toBe("None");
  });

  test("falls back to null when the language sends no spelling", () => {
    expect(formatRoot(DataTreeNode.empty())).toBe("null");
  });

  test("formats a leaf as before", () => {
    expect(formatRoot(DataTreeNode.leaf("hi", "string"))).toBe('"hi"');
    expect(formatRoot(DataTreeNode.leaf("42", "number"))).toBe("42");
  });
});
