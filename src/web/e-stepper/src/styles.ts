/**
 * The e-stepper's own styling (the program pane also uses the stepper's, injected by
 * `../../stepper/src/styles`). Injected once, like the stepper's, so the plugin needs no styles from
 * the host.
 */
const E_STEPPER_CSS = `
.sa-e-stepper { display: flex; flex-direction: column; height: 100%; min-height: 400px; outline: none; }
.sa-e-stepper .estepper-main { position: relative; display: flex; flex: 1; min-height: 0; gap: 8px; }
.sa-e-stepper .estepper-main.narrow { flex-direction: column; }
.sa-e-stepper .estepper-left { display: flex; flex-direction: column; min-width: 0; min-height: 0; }
.sa-e-stepper .estepper-program {
  overflow: auto; padding: 8px 10px; border-radius: 4px; background: rgba(16, 22, 26, 0.3);
}
.sa-e-stepper .estepper-divider {
  height: 6px; margin: 2px 0; cursor: row-resize; border-radius: 3px; background: rgba(255, 255, 255, 0.15);
  flex: 0 0 auto;
}
.sa-e-stepper .estepper-divider.vertical {
  height: auto; width: 6px; margin: 0 -2px; align-self: stretch; cursor: col-resize; flex: 0 0 auto;
}
.sa-e-stepper .estepper-divider:hover { background: rgba(255, 255, 255, 0.35); }
.sa-e-stepper .estepper-diagram {
  flex: 1; min-height: 240px; min-width: 0; border-radius: 4px; background: #1a2530; overflow: hidden;
}
.sa-e-stepper .estepper-output-toggle { cursor: pointer; user-select: none; font-size: 12px; color: #dd8c60; }
.sa-e-stepper .estepper-output {
  margin: 4px 0 0; max-height: 7.5em; overflow: auto; white-space: pre-wrap; word-break: break-word;
  font: 14px/normal 'Inconsolata', 'Consolas', monospace; color: #dd8c60;
  background: transparent; box-shadow: none; padding: 0;
}
.sa-e-stepper .estepper-envblock {
  display: inline-block; vertical-align: top; position: relative;
  border-left: 3px solid; border-top: 1px dashed; border-radius: 4px 0 0 4px;
  padding: 10px 6px 2px 8px; margin: 1px 0;
}
.sa-e-stepper .estepper-envblock-label {
  position: absolute; top: -1px; left: -3px; padding: 0 4px; border-radius: 3px 0 3px 0;
  font-size: 10px; line-height: 12px; color: #10161a; font-weight: bold;
}
.sa-e-stepper .estepper-envblock-label { cursor: default; }
.sa-e-stepper .estepper-envblock.hovered {
  border-left-width: 5px; background: rgba(0, 0, 0, 0.45);
  box-shadow: inset 0 0 0 1px var(--estepper-frame-color);
}
.sa-e-stepper .estepper-program-arrows {
  position: absolute; left: 0; top: 0; width: 100%; height: 100%; overflow: visible;
  pointer-events: none; z-index: 2;
}
.sa-e-stepper .estepper-options { padding: 8px 12px; min-width: 230px; }
.sa-e-stepper .estepper-options .bp6-switch { margin-bottom: 6px; }
.sa-e-stepper .estepper-ref { cursor: default; border-radius: 3px; }
.sa-e-stepper .estepper-ref-badge {
  display: inline-block; padding: 0 3px; border-radius: 3px; font-size: 12px;
  background: rgba(255, 255, 255, 0.12); color: #c5cbd3; vertical-align: 1px;
}
.sa-e-stepper .estepper-ref-name { font-weight: bold; margin-right: 2px; }
.sa-e-stepper .estepper-ref.hovered .estepper-ref-badge {
  background: #000000; color: #ffffff; box-shadow: 0 0 0 1px #c5cbd3;
}
`;

const STYLE_ELEMENT_ID = "sa-e-stepper-styles";

/** Injects (or refreshes) the e-stepper's stylesheet, like the stepper's own `injectStepperStyles`. */
export function injectEStepperStyles(): void {
  if (typeof document === "undefined") return;
  let style = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;
  if (style === null) {
    style = document.createElement("style");
    style.id = STYLE_ELEMENT_ID;
    document.head.appendChild(style);
  }
  if (style.textContent !== E_STEPPER_CSS) style.textContent = E_STEPPER_CSS;
}
