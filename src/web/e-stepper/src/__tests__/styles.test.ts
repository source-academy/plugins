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
])("the %s styles are injected once and kept up to date", (_name, inject, selector) => {
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
});

test("injecting without a document does nothing", () => {
  expect(() => injectEStepperStyles()).not.toThrow();
  expect(() => injectStepperStyles()).not.toThrow();
});
