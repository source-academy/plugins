/**
 * The stepper's styling, self-contained so the Host plugin needs no styles from the frontend.
 * Values are inlined from the frontend's `_stepperVariables.scss` / `_workspace.scss` so the
 * rendered output is visually identical to the legacy in-frontend stepper.
 */
const STEPPER_CSS = `
.sa-substituter .stepper-literal,
.stepper-popover .stepper-literal { color: #ff6078; }
.sa-substituter .stepper-operator,
.stepper-popover .stepper-operator { color: #f89210; }
.sa-substituter .stepper-identifier,
.stepper-popover .stepper-identifier { color: #f8d871; }
.sa-substituter .stepper-conditional-operator,
.stepper-popover .stepper-conditional-operator { color: #ffffff; }

.sa-substituter .stepper-display {
  font: 16px/normal 'Inconsolata', 'Consolas', monospace;
  color: #ffffff;
  margin-bottom: 16px;
}

/* The explanation panel wraps a Blueprint <Pre> in a <Card>. Blueprint's <Pre> carries its own
 * background + inset box-shadow + padding, which reads as a second box nested inside the Card. The
 * legacy in-frontend stepper avoided this because the REPL's SCSS cascade flattened the <Pre>; this
 * plugin is self-contained, so flatten it here. Keep the monospace/whitespace formatting; only drop
 * the box so the Card is the single visible container. The element+2-class selector outranks
 * Blueprint's '.bp6-dark .bp6-pre'. */
.sa-substituter pre.result-output {
  background: transparent;
  box-shadow: none;
  margin: 0;
  padding: 0;
  color: #ffffff;
  white-space: pre-wrap;
  word-break: break-word;
  font: 16px/normal 'Inconsolata', 'Consolas', monospace;
}
/* The output panel: identical formatting to the explanation box's <Pre> above, but coloured with the
 * workspace REPL's printed-output orange ($code-color-log, #dd8c60) so program output reads the same
 * as it does on the home/intro tab. */
.sa-substituter pre.stepper-output {
  background: transparent;
  box-shadow: none;
  margin: 0;
  padding: 0;
  color: #dd8c60;
  white-space: pre-wrap;
  word-break: break-word;
  font: 16px/normal 'Inconsolata', 'Consolas', monospace;
}
.stepper-popover .stepper-display {
  font: 16px/normal 'Inconsolata', 'Consolas', monospace;
}

/* An opaque value's rendered thumbnail (see the image SyntaxTemplatePart) — shown inline at text
 * height, DrRacket-style, rather than expanding the line. */
.sa-substituter .stepper-opaque-thumbnail,
.stepper-popover .stepper-opaque-thumbnail {
  height: 1.4em;
  width: auto;
  vertical-align: middle;
  border-radius: 3px;
}

/* The same thumbnail enlarged, shown in the hover popover so an opaque value (e.g. a rune) is
 * actually legible while the inline copy stays at text height. A fixed width (not max-width) forces
 * a low-resolution thumbnail to scale up rather than render at its small intrinsic size. */
.sa-substituter .stepper-opaque-thumbnail-large,
.stepper-popover .stepper-opaque-thumbnail-large {
  display: block;
  width: min(200px, 50vw);
  height: auto;
  margin-top: 6px;
  border-radius: 3px;
  image-rendering: auto;
}

.sa-substituter .stepper-mu-term,
.stepper-popover .stepper-mu-term {
  font-weight: bold;
  pointer-events: auto;
  cursor: pointer;
  z-index: 20;
  padding: 0px 3px;
  border-radius: 5px;
  background: transparent;
}
.sa-substituter .stepper-mu-term:hover { background: transparent; }

.sa-substituter .beforeMarker {
  position: relative;
  -webkit-box-decoration-break: slice;
  box-decoration-break: slice;
  background: rgba(172, 0, 0, 0.75);
  pointer-events: auto;
  cursor: pointer;
  z-index: 20;
}
.sa-substituter .beforeMarker:hover { background: rgba(100, 101, 57, 0.75); }

.sa-substituter .afterMarker {
  position: relative;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
  background: green;
  pointer-events: auto;
  cursor: pointer;
  z-index: 20;
}
.sa-substituter .afterMarker:hover { background: rgba(61, 101, 57, 0.75); }

/* Match the legacy stepper's margin around the whole component */
.sa-substituter {
  margin: 15px;
  height: unset;
}

/* Hide all intermediate slider step labels; only show first and last.
 * Mirrors the frontend's _workspace.scss rule for #bp6-tab-panel_side-content-tabs_subst_visualiser */
.sa-substituter .bp6-slider-label,
.sa-substituter .bp5-slider-label,
.sa-substituter .bp4-slider-label,
.sa-substituter .bp3-slider-label {
  width: max-content;
  display: none;
}
.sa-substituter .bp6-slider-label:first-child,
.sa-substituter .bp6-slider-label:last-child,
.sa-substituter .bp5-slider-label:first-child,
.sa-substituter .bp5-slider-label:last-child,
.sa-substituter .bp4-slider-label:first-child,
.sa-substituter .bp4-slider-label:last-child,
.sa-substituter .bp3-slider-label:first-child,
.sa-substituter .bp3-slider-label:last-child {
  display: inline;
}

/* Match the legacy stepper's explanation card styling */
.sa-substituter .bp6-card,
.sa-substituter .bp5-card,
.sa-substituter .bp4-card,
.sa-substituter .bp3-card {
  background-color: #1a2530;
  padding: 0.4rem 0.6rem 0.4rem 0.6rem;
  margin: 2rem 0 0.5rem 0;
}
`;

const STYLE_ELEMENT_ID = "__sa_stepper_styles";

/** Injects (or refreshes) the stepper stylesheet in the document. No-op outside the browser. */
export function injectStepperStyles(): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (style === null) {
    style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    document.head.appendChild(style);
  }
  // Always (re)write the content instead of no-op'ing when the element already exists: a rebuilt bundle
  // carrying updated CSS must replace any copy injected by an earlier load in the same document, or the
  // stale styles silently mask the change (e.g. across a plugin remount in local dev — a new
  // `.stepper-output` rule would never take effect and printed output would keep the default colour).
  if (style.textContent !== STEPPER_CSS) style.textContent = STEPPER_CSS;
}
