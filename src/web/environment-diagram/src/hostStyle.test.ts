// @vitest-environment jsdom
import { afterEach, describe, expect, test, vi } from "vitest";

import { Config } from "./CseMachineConfig";
import { defaultBackgroundColor } from "./CseMachineUtils";
import {
  BACKGROUND_PROPERTY,
  clearHostStyleSource,
  hostBackgroundColor,
  observeHostStyle,
  setHostStyleSource,
} from "./hostStyle";

/** A drawing area inside a host page: `page` > `area`, both on the document. */
function mount() {
  const page = document.createElement("div");
  const area = document.createElement("div");
  page.appendChild(area);
  document.body.appendChild(page);
  return { page, area };
}

afterEach(() => {
  setHostStyleSource(null);
  document.body.innerHTML = "";
});

describe("the host's background for a drawing", () => {
  test("is none until a source is set, and when the host sets nothing", () => {
    expect(hostBackgroundColor()).toBeNull();
    const { area } = mount();
    setHostStyleSource(area);
    expect(hostBackgroundColor()).toBeNull();
    expect(defaultBackgroundColor()).toBe(Config.BgColor);
  });

  test("is what the host sets on the element, and the drawing's background follows it", () => {
    const { area } = mount();
    area.style.setProperty(BACKGROUND_PROPERTY, "#00ff00");
    setHostStyleSource(area);
    expect(hostBackgroundColor()).toBe("#00ff00");
    expect(defaultBackgroundColor()).toBe("#00ff00");
  });

  test("a view that goes away stops being the source", () => {
    const { area } = mount();
    area.style.setProperty(BACKGROUND_PROPERTY, "#00ff00");
    setHostStyleSource(area);
    clearHostStyleSource(area);
    expect(hostBackgroundColor()).toBeNull();
    // Another view's is not cleared by this one's going away.
    const other = mount().area;
    setHostStyleSource(other);
    clearHostStyleSource(area);
    other.style.setProperty(BACKGROUND_PROPERTY, "#123456");
    expect(hostBackgroundColor()).toBe("#123456");
  });
});

describe("observeHostStyle", () => {
  test("tells when the host changes the background by a style above the element", async () => {
    const { page, area } = mount();
    const onChange = vi.fn();
    const stop = observeHostStyle(area, onChange);

    page.style.setProperty(BACKGROUND_PROPERTY, "#00ff00");

    await vi.waitFor(() => expect(onChange).toHaveBeenCalledTimes(1));
    stop();
  });

  test("does not tell of a change that leaves the background as it was", async () => {
    const { page, area } = mount();
    const onChange = vi.fn();
    const stop = observeHostStyle(area, onChange);

    // A panel being dragged changes styles all the time.
    page.style.width = "300px";
    page.className = "some-class";
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(onChange).not.toHaveBeenCalled();
    stop();
  });

  test("stops when told to", async () => {
    const { page, area } = mount();
    const onChange = vi.fn();
    observeHostStyle(area, onChange)();

    page.style.setProperty(BACKGROUND_PROPERTY, "#00ff00");
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(onChange).not.toHaveBeenCalled();
  });
});
