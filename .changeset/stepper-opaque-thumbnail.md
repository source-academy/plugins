---
"@sourceacademy/common-stepper": patch
---

Add an `image` `SyntaxTemplatePart` (renders a node's data-URL property as an inline `<img>`, e.g. a rendered thumbnail for an opaque runtime value — DrRacket-style — falling back to nothing when the property is absent) and an `unless` part (the inverse of `when`, for pairing an image with a textual fallback). `web-stepper` renders both generically; a language opts in by using them in its `SyntaxProfile` templates. Both additions are optional and backward-compatible.
