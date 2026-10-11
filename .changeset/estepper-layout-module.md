---
"@sourceacademy/web-e-stepper": patch
---

e-stepper: the arrangement of the panes and the divider survive a Run (the host makes a new plugin on every Run, and calls the bundle's factory again, so they are kept for the page on `globalThis`)
