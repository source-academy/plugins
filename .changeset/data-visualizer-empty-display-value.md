---
"@sourceacademy/common-data-visualizer": patch
---

Add an optional `displayValue` to the `"empty"` node, so a language can say how its empty value is written (e.g. `None` for Python). `web-data-visualizer` shows it when the empty value is drawn on its own, instead of always showing `null`. Inside a pair/array it is still drawn as a diagonal slash. Languages that omit it still get `null`.
