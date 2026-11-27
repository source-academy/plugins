/**
 * What the host's own styling says about how a drawing should look, read from CSS custom properties
 * (the drawing is on a canvas, which CSS cannot colour, so it asks the style of an element that is in
 * the host's page, and so inherits what the host sets on its ancestors). The library names no host
 * mode and no host class: a host that wants another background sets
 * {@link BACKGROUND_PROPERTY} on an element above the drawing, e.g. in its own stylesheet.
 */

/** The custom property with the background colour of a drawing. Unset, the library's own applies. */
export const BACKGROUND_PROPERTY = "--visualizer-background";

/** The element whose computed style is read: one that is on the page, set by the view that draws. */
let source: Element | null = null;

/** Sets the element to read the host's style from, or none; see {@link hostBackgroundColor}. */
export function setHostStyleSource(element: Element | null): void {
  source = element;
}

/** Stops reading from `element`, if it is the source. A view that goes away calls this. */
export function clearHostStyleSource(element: Element): void {
  if (source === element) source = null;
}

/** The host's background colour for a drawing, or `null` if it sets none (or there is no source). */
export function hostBackgroundColor(): string | null {
  return source === null ? null : readBackground(source);
}

/**
 * Calls `onChange` when the host's background colour for `element` changes. A host changes it by
 * changing a class or a style on `element` or above it (a mode, a theme), so those attributes are
 * watched, from `element` to the root; and `onChange` is called only if the colour is now another, since
 * styles change all the time (a panel being dragged) and a drawing is not to be redone for each.
 * Returns the function that stops watching.
 */
export function observeHostStyle(element: Element, onChange: () => void): () => void {
  if (typeof MutationObserver === "undefined") return () => {};
  let seen = readBackground(element);
  const observer = new MutationObserver(() => {
    const now = readBackground(element);
    if (now !== seen) {
      seen = now;
      onChange();
    }
  });
  for (let node: Element | null = element; node !== null; node = node.parentElement) {
    observer.observe(node, { attributes: true, attributeFilter: ["class", "style"] });
  }
  return () => observer.disconnect();
}

function readBackground(element: Element): string | null {
  if (!element.isConnected || typeof getComputedStyle === "undefined") return null;
  const value = getComputedStyle(element).getPropertyValue(BACKGROUND_PROPERTY).trim();
  return value === "" ? null : value;
}
