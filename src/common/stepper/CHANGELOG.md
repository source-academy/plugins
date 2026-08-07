# @sourceacademy/common-stepper

## 0.0.3

### Patch Changes

- 065da98: Add an `image` `SyntaxTemplatePart` (renders a node's data-URL property as an inline `<img>`, e.g. a rendered thumbnail for an opaque runtime value — DrRacket-style — falling back to nothing when the property is absent) and an `unless` part (the inverse of `when`, for pairing an image with a textual fallback). `web-stepper` renders both generically; a language opts in by using them in its `SyntaxProfile` templates. Both additions are optional and backward-compatible.

## 0.0.2

### Patch Changes

- c50e84e: Add an optional `output` field to `SerializedStepperStep`. A runner can use it to report the program's cumulative textual output (e.g. everything `print` has written) up to each step, so a host can render a running output panel that grows as the slider advances. The field is optional and backward-compatible: runners that produce no output may omit it, and hosts that ignore it are unaffected.
