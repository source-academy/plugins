import { describe, expect, test } from "vitest";

import {
  arrowGeometry,
  computeProgramArrows,
  ENV_ATTRIBUTE,
  REF_ATTRIBUTE,
} from "../ProgramArrows";

const rect = (left: number, top: number, width: number, height: number) =>
  ({ left, top, right: left + width, bottom: top + height, width, height }) as DOMRect;

/** A fake element whose box is `box`, with the marks of `marks` inside it. */
function fake(box: DOMRect, attributes: Record<string, string> = {}, marks: unknown[] = []) {
  return {
    getBoundingClientRect: () => box,
    getAttribute: (name: string) => attributes[name] ?? null,
    querySelectorAll: (selector: string) => {
      const attribute = selector.slice(1, -1);
      return marks.filter(m => (m as Element).getAttribute(attribute) !== null);
    },
  } as unknown as Element;
}

describe("arrowGeometry", () => {
  test("leaves and arrives horizontally when the target is further across than down", () => {
    const { path, head } = arrowGeometry({ x: 0, y: 0 }, { x: 100, y: 20 });
    expect(path).toBe("M 0 0 C 50 0, 50 20, 100 20");
    expect(head.startsWith("100 20 ")).toBe(true);
  });

  test("goes vertically when the panes are stacked", () => {
    const { path } = arrowGeometry({ x: 10, y: 0 }, { x: 0, y: 200 });
    expect(path).toBe("M 10 0 C 10 100, 0 100, 0 200");
  });

  test("bends back correctly when the target is to the left", () => {
    expect(arrowGeometry({ x: 100, y: 0 }, { x: 0, y: 0 }).path).toBe("M 100 0 C 50 0, 50 0, 0 0");
  });
});

describe("computeProgramArrows", () => {
  const container = fake(rect(100, 50, 800, 400));
  const program = (marks: unknown[]) => fake(rect(100, 50, 300, 400), {}, marks);
  const diagram = fake(rect(500, 50, 400, 400));
  const resolve = ({ kind, id }: { kind: string; id: string }) =>
    id === "missing" ? null : kind === "object" ? { x: 10, y: 20 } : { x: 30, y: 40 };

  test("draws an arrow from each badge and bracket label to its target, in container coordinates", () => {
    const ref = fake(rect(150, 100, 20, 10), { [REF_ATTRIBUTE]: "#1" });
    const env = fake(rect(120, 200, 20, 12), { [ENV_ATTRIBUTE]: "E1" });
    const arrows = computeProgramArrows(container, program([ref, env]), diagram, resolve);
    expect(arrows.map(a => [a.kind, a.id, a.from, a.to])).toEqual([
      ["object", "#1", { x: 70, y: 55 }, { x: 410, y: 20 }],
      ["frame", "E1", { x: 40, y: 156 }, { x: 430, y: 40 }],
    ]);
  });

  test("skips marks scrolled out of the program pane, and targets that are not drawn or not in view", () => {
    const scrolledOut = fake(rect(150, 600, 20, 10), { [REF_ATTRIBUTE]: "#1" });
    const notDrawn = fake(rect(150, 100, 20, 10), { [REF_ATTRIBUTE]: "missing" });
    const outOfView = fake(rect(150, 100, 20, 10), { [REF_ATTRIBUTE]: "#3" });
    const far = ({ id }: { id: string }) =>
      id === "#3" ? { x: 900, y: 20 } : id === "missing" ? null : { x: 1, y: 1 };
    expect(
      computeProgramArrows(container, program([scrolledOut, notDrawn, outOfView]), diagram, far),
    ).toHaveLength(0);
  });
});
