import { afterEach, expect, test, vi } from "vitest";

import { injectStepperStyles } from "../../../stepper/src/styles";
import { injectEStepperStyles } from "../styles";

/** A minimal `document`: the injectors only look up, create and append style elements. */
function fakeDocument() {
  const elements: Record<string, { id: string; textContent: string }> = {};
  const head: { id: string; textContent: string }[] = [];
  return {
    head: {
      appendChild: (e: { id: string; textContent: string }) => (head.push(e), (elements[e.id] = e)),
    },
    getElementById: (id: string) => elements[id] ?? null,
    createElement: () => ({ id: "", textContent: "" }),
    appended: head,
  };
}

afterEach(() => vi.unstubAllGlobals());

test.each([
  ["e-stepper", injectEStepperStyles, ".sa-e-stepper"],
  ["stepper", injectStepperStyles, ".sa-substituter"],
])(
  "the %s styles are injected once and kept up to date",
  (_name: string, inject: () => void, selector: string) => {
    const doc = fakeDocument();
    vi.stubGlobal("document", doc);
    inject();
    inject();
    expect(doc.appended).toHaveLength(1);
    expect(doc.appended[0].textContent).toContain(selector);
    // A stale copy (e.g. from an earlier load of the plugin) is replaced.
    doc.appended[0].textContent = "stale";
    inject();
    expect(doc.appended[0].textContent).toContain(selector);
  },
);

test("injecting without a document does nothing", () => {
  expect(() => injectEStepperStyles()).not.toThrow();
  expect(() => injectStepperStyles()).not.toThrow();
});

test("the dividers between the panes never shrink away, however short the tab is", () => {
  const doc = fakeDocument();
  vi.stubGlobal("document", doc);
  injectEStepperStyles();
  const css = doc.appended[0].textContent;
  // In a stacked tab the program pane has a fixed height and the diagram a least height, so a flex
  // item that may shrink (the default) would be squeezed to nothing.
  const rule = (selector: string) =>
    css.slice(css.indexOf(selector), css.indexOf("}", css.indexOf(selector)));
  expect(rule(".sa-e-stepper .estepper-divider {")).toContain("flex: 0 0 auto");
  expect(rule(".sa-e-stepper .estepper-divider.vertical")).toContain("flex: 0 0 auto");
});
