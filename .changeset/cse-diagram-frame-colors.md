---
"@sourceacademy/common-cse-machine": patch
---

`CseDiagramViewProps` takes `frameColors` (frame colours by frame id; the active frame keeps its colour, with a wider outline), and `hoveredFrame` / `onHoverFrame`, so a plugin and the host's diagram highlight the same frame.
